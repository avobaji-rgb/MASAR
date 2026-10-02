import { pool } from "@workspace/db";

// Application tables live in public. Keep pre-existing tables intact.
// Legacy compatibility helper retained for explicit maintenance only; it is not invoked at API startup.
export async function migrateMembership(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bank_memberships (
        user_id text PRIMARY KEY,
        plan text NOT NULL CHECK (plan IN ('basic', 'premium')),
        billing text NOT NULL CHECK (billing IN ('monthly', 'annual')),
        confirmed_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        confirmed_by text NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.registered_vehicles (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        make text NOT NULL,
        plate text NOT NULL,
        electric boolean NOT NULL DEFAULT false
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.roadside_requests (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        vehicle_id text NOT NULL,
        service text NOT NULL,
        location text NOT NULL,
        garage text,
        replacement_transport boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS registered_vehicles_user_idx ON public.registered_vehicles (user_id)");
    await client.query(`
      ALTER TABLE public.roadside_requests
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS operator_id text,
      ADD COLUMN IF NOT EXISTS operator_name text,
      ADD COLUMN IF NOT EXISTS provider_id text,
      ADD COLUMN IF NOT EXISTS provider_name text,
      ADD COLUMN IF NOT EXISTS provider_acknowledged_at timestamptz,
      ADD COLUMN IF NOT EXISTS transport_status text NOT NULL DEFAULT 'not_requested',
      ADD COLUMN IF NOT EXISTS status_note text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    `);
    await client.query("UPDATE public.roadside_requests SET transport_status = 'pending' WHERE replacement_transport AND transport_status = 'not_requested'");
    await client.query("CREATE INDEX IF NOT EXISTS roadside_requests_user_idx ON public.roadside_requests (user_id)");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}