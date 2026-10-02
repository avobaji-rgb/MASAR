import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: `${sidecar}/token`, type: "external_account",
    credential_source: { url: `${sidecar}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateRoot(): { bucket: string; root: string } {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const parts = value.replace(/^\/+/, "").split("/");
  const bucket = parts.shift();
  if (!bucket || parts.length === 0) throw new Error("PRIVATE_OBJECT_DIR must include a bucket and private directory");
  return { bucket, root: parts.join("/") };
}

function objectName(path: string): string {
  const { root } = privateRoot();
  if (!path.startsWith("/objects/")) throw new Error("Invalid private object path");
  const name = path.slice("/objects/".length);
  if (!name.startsWith("uploads/") || name.includes("..") || name.includes("\\")) throw new Error("Invalid private object path");
  return `${root}/${name}`;
}

async function sign(bucket: string, name: string, method: "PUT" | "GET", ttlSeconds: number, contentType?: string): Promise<string> {
  const result = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket, object_name: name, method,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      ...(contentType ? { content_type: contentType } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!result.ok) throw new Error(`Could not sign object URL (${result.status})`);
  const json = await result.json() as { signed_url?: string };
  if (!json.signed_url) throw new Error("Object storage returned no signed URL");
  return json.signed_url;
}

export function newPartnerObjectPath(): string {
  return `/objects/uploads/partners/${randomUUID()}`;
}

export async function signedPartnerUpload(path: string, contentType: string): Promise<string> {
  const { bucket } = privateRoot();
  return sign(bucket, objectName(path), "PUT", 900, contentType);
}

export async function inspectPartnerObject(path: string): Promise<{ exists: boolean; size: number; contentType: string; file: File }> {
  const { bucket } = privateRoot();
  const file = storage.bucket(bucket).file(objectName(path));
  const [exists] = await file.exists();
  if (!exists) return { exists: false, size: 0, contentType: "", file };
  const [metadata] = await file.getMetadata();
  return { exists: true, size: Number(metadata.size ?? 0), contentType: String(metadata.contentType ?? ""), file };
}

export async function signedPartnerRead(path: string): Promise<string> {
  const { bucket } = privateRoot();
  return sign(bucket, objectName(path), "GET", 300);
}