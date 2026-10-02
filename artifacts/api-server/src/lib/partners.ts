import { randomUUID } from "node:crypto";
import { logger } from "./logger";
export { companySupportsService } from "./partnerPolicy";

type QueryClient = { query: (...args: any[]) => Promise<any> };

export async function auditPartner(
  client: QueryClient,
  data: { companyId: string | null; requestId: string | null; actorId: string; action: string; details?: unknown },
): Promise<void> {
  await client.query(
    `INSERT INTO partner_audit (id, company_id, request_id, actor_id, action, details)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), data.companyId, data.requestId, data.actorId, data.action,
      typeof data.details === "string" ? data.details : JSON.stringify(data.details ?? {})],
  );
}

export async function enqueuePartnerPush(
  client: QueryClient,
  userId: string,
  jobId: string,
  event: string,
): Promise<void> {
  await client.query(
    `INSERT INTO partner_push_outbox (id,user_id,job_id,event) VALUES ($1,$2,$3,$4)`,
    [randomUUID(), userId, jobId, event],
  );
}

// Delivery is best-effort and durable: due rows are retried, never replaced with a fake success.
export async function deliverPartnerPushOutbox(pool: QueryClient): Promise<void> {
  if (process.env.NODE_ENV !== "production" && process.env.MASAR_PARTNER_PUSH_ENABLED !== "true") return;
  let rows: { rows: Array<{ id: string; device_token: string; job_id: string }> };
  try {
    await pool.query(
      `INSERT INTO partner_push_deliveries (id,outbox_id,device_token)
       SELECT gen_random_uuid()::text,o.id,d.token
       FROM partner_push_outbox o JOIN partner_devices d ON d.user_id=o.user_id AND d.active=true
       WHERE o.delivered_at IS NULL
       ON CONFLICT (outbox_id,device_token) DO NOTHING`,
    );
    const receipts = await pool.query(
      `SELECT id,ticket_id,device_token FROM partner_push_deliveries
       WHERE status='ticketed' AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 100`,
    );
    if (receipts.rows.length) {
      const result = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ids: receipts.rows.map((r: any) => r.ticket_id) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok) throw new Error(`Expo receipts returned ${result.status}`);
      const payload = await result.json() as { data?: Record<string, { status?: string; details?: { error?: string } }> };
      for (const receipt of receipts.rows as Array<{ id: string; ticket_id: string; device_token: string }>) {
        const value = payload.data?.[receipt.ticket_id];
        if (value?.status === "ok") {
          await pool.query("UPDATE partner_push_deliveries SET status='delivered',delivered_at=now() WHERE id=$1", [receipt.id]);
        } else if (value?.details?.error === "DeviceNotRegistered") {
          await pool.query("UPDATE partner_devices SET active=false WHERE token=$1", [receipt.device_token]);
          await pool.query("UPDATE partner_push_deliveries SET status='failed',delivered_at=now() WHERE id=$1", [receipt.id]);
        } else {
          await pool.query("UPDATE partner_push_deliveries SET status='queued',ticket_id=NULL,attempts=attempts+1,next_attempt_at=now()+interval '1 minute' WHERE id=$1", [receipt.id]);
        }
      }
    }
    rows = await pool.query(
      `SELECT d.id,d.device_token,o.job_id
       FROM partner_push_deliveries d JOIN partner_push_outbox o ON o.id=d.outbox_id
       WHERE d.status='queued' AND d.next_attempt_at<=now()
       ORDER BY d.next_attempt_at LIMIT 50`,
    );
  } catch (error) {
    logger.warn({ err: error }, "Partner push outbox is unavailable");
    return;
  }
  for (const row of rows.rows as Array<{ id: string; device_token: string; job_id: string }>) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify([{ to: row.device_token, title: "MASAR job update", body: "Open MASAR Partners to view your job update.", data: { jobId: row.job_id } }]),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Expo push returned ${response.status}`);
      const result = await response.json() as { data?: Array<{ status?: string; id?: string; details?: { error?: string } }> };
      const ticket = result.data?.[0];
      if (ticket?.details?.error === "DeviceNotRegistered") {
        await pool.query("UPDATE partner_devices SET active=false WHERE token=$1", [row.device_token]);
        await pool.query("UPDATE partner_push_deliveries SET status='failed',delivered_at=now() WHERE id=$1", [row.id]);
      } else if (ticket?.status === "ok" && ticket.id) {
        await pool.query(
          "UPDATE partner_push_deliveries SET status='ticketed',ticket_id=$1,next_attempt_at=now()+interval '15 minutes' WHERE id=$2",
          [ticket.id, row.id],
        );
      } else {
        await pool.query("UPDATE partner_push_deliveries SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute' WHERE id=$1", [row.id]);
      }
    } catch (error) {
      logger.warn({ err: error, deliveryId: row.id }, "Partner push delivery failed");
      await pool.query("UPDATE partner_push_deliveries SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute' WHERE id=$1", [row.id]).catch(() => undefined);
    }
  }
  await pool.query(
    `UPDATE partner_push_outbox o SET delivered_at=now()
     WHERE o.delivered_at IS NULL AND EXISTS (SELECT 1 FROM partner_push_deliveries d WHERE d.outbox_id=o.id)
     AND NOT EXISTS (SELECT 1 FROM partner_push_deliveries d WHERE d.outbox_id=o.id AND d.status NOT IN ('delivered','failed'))`,
  ).catch(error => logger.warn({ err: error }, "Could not finalize partner push outbox"));
}