import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LOCAL_CONFIG = join(process.cwd(), "config-supabase.env");
const DEFAULT_BUCKET = "fileo";

if ((!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) && existsSync(LOCAL_CONFIG)) {
  process.loadEnvFile(LOCAL_CONFIG);
}

declare global {
  var __fileoSupabaseAdmin: SupabaseClient | undefined;
}

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Configuration Supabase absente. Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!globalThis.__fileoSupabaseAdmin) {
    globalThis.__fileoSupabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return globalThis.__fileoSupabaseAdmin;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_PRIVATE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export async function ensureStorageBucket(): Promise<string> {
  const bucket = storageBucket();
  const supabase = supabaseAdmin();
  const { data: existing, error: getError } = await supabase.storage.getBucket(bucket);
  if (!getError && existing) return bucket;

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: "8MB",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
    ],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Impossible de preparer le bucket Storage: ${error.message}`);
  }
  return bucket;
}
