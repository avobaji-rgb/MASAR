import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Development-only fixtures are removed in finally; never point this at production.
test("partner assignment database invariants", async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production", "Run only against development");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const prefix = `test-partners-${randomUUID()}`;
  const companyA = `${prefix}-a`;
  const companyB = `${prefix}-b`;
  const requestId = `${prefix}-request`;
  const jobId = `${prefix}-job`;
  try {
    for (const id of [companyA, companyB]) {
      await pool.query(
        `INSERT INTO partner_companies
         (id,owner_id,name,type,phone,contact,address,city,area,hours,services,status,available)
         VALUES ($1,$2,'Test fixture','towing','','','','','','','["towing"]','approved',true)`,
        [id, `${id}-owner`],
      );
      await pool.query(
        `INSERT INTO partner_members (id,company_id,user_id,role)
         VALUES ($1,$2,$3,'owner')`,
        [`${id}-member`, id, `${id}-owner`],
      );
    }
    await pool.query(
      `INSERT INTO roadside_requests (id,user_id,vehicle_id,service,location,status,provider_id)
       VALUES ($1,$2,$3,'tow','Test location','offered',$4)`,
      [requestId, `${prefix}-customer`, `${prefix}-vehicle`, `partner:${companyA}`],
    );
    await pool.query(
      `INSERT INTO partner_jobs
       (id,company_id,request_id,service,location,vehicle_make,vehicle_plate,status,offered_at,expires_at)
       VALUES ($1,$2,$3,'tow','Test location','','','offered',now(),now()+interval '5 minutes')`,
      [jobId, companyA, requestId],
    );

    await t.test("a request cannot have two active company assignments", async () => {
      await assert.rejects(
        pool.query(
          `INSERT INTO partner_jobs
           (id,company_id,request_id,service,location,vehicle_make,vehicle_plate,status,offered_at,expires_at)
           VALUES ($1,$2,$3,'tow','Test location','','','offered',now(),now()+interval '5 minutes')`,
          [`${prefix}-duplicate`, companyB, requestId],
        ),
        (error) => error.code === "23505",
      );
    });

    await t.test("company memberships do not grant access to another company", async () => {
      const result = await pool.query(
        "SELECT id FROM partner_members WHERE company_id=$1 AND user_id=$2 AND active=true",
        [companyB, `${companyA}-owner`],
      );
      assert.equal(result.rowCount, 0);
    });

    await t.test("two simultaneous versioned acceptances have exactly one winner", async () => {
      const accept = async (actor) => {
        const connection = await pool.connect();
        try {
          await connection.query("BEGIN");
          const locked = await connection.query(
            "SELECT status,version FROM partner_jobs WHERE id=$1 FOR UPDATE",
            [jobId],
          );
          const current = locked.rows[0];
          if (current.status !== "offered" || current.version !== 0) {
            await connection.query("ROLLBACK");
            return false;
          }
          await connection.query(
            "SELECT id FROM roadside_requests WHERE id=$1 FOR UPDATE",
            [requestId],
          );
          await connection.query(
            `UPDATE partner_jobs SET status='accepted',version=version+1,
             accepted_at=now(),accepted_by_id=$2 WHERE id=$1`,
            [jobId, actor],
          );
          await connection.query(
            "UPDATE roadside_requests SET status='accepted',provider_acknowledged_at=now() WHERE id=$1",
            [requestId],
          );
          await connection.query("COMMIT");
          return true;
        } catch (error) {
          await connection.query("ROLLBACK");
          throw error;
        } finally {
          connection.release();
        }
      };
      const result = await Promise.all([
        accept(`${companyA}-owner`),
        accept(`${companyA}-planner`),
      ]);
      assert.deepEqual(result.sort(), [false, true]);
      const row = await pool.query(
        "SELECT status,version FROM partner_jobs WHERE id=$1",
        [jobId],
      );
      assert.equal(row.rows[0].version, 1);
      assert.equal(row.rows[0].status, "accepted");
    });

    await t.test("stale or repeated versioned writes do not update an accepted job", async () => {
      const result = await pool.query(
        "UPDATE partner_jobs SET status='enroute',version=version+1 WHERE id=$1 AND version=0 RETURNING id",
        [jobId],
      );
      assert.equal(result.rowCount, 0);
    });

    await t.test("past deadlines cannot expire an accepted assignment", async () => {
      await pool.query("UPDATE partner_jobs SET expires_at=now()-interval '1 minute' WHERE id=$1", [jobId]);
      const result = await pool.query(
        "UPDATE partner_jobs SET status='expired' WHERE id=$1 AND status='offered' AND expires_at<=now() RETURNING id",
        [jobId],
      );
      assert.equal(result.rowCount, 0);
    });
  } finally {
    await pool.query("DELETE FROM partner_jobs WHERE request_id=$1", [requestId]);
    await pool.query("DELETE FROM roadside_requests WHERE id=$1", [requestId]);
    await pool.query("DELETE FROM partner_companies WHERE id IN ($1,$2)", [companyA, companyB]);
    await pool.end();
  }
});