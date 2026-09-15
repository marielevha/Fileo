import "server-only";

import { createHash } from "node:crypto";
import { collection, newId, nowIso } from "@/lib/db";
import { ensureStorageBucket, supabaseAdmin } from "@/lib/supabase/admin";

const MAX_FILES = 8;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type AttachmentKind = "measurement_photo" | "model_photo" | "receipt" | "payment_proof" | "other";

export type AttachmentRow = {
  id: string;
  workshop_id: string;
  order_id: string | null;
  order_item_id: string | null;
  client_id: string | null;
  kind: AttachmentKind;
  bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
};

export type AttachmentWithUrl = AttachmentRow & {
  signed_url: string | null;
};

export class AttachmentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentUploadError";
  }
}

export async function uploadOrderAttachments(input: {
  workshopId: string;
  orderId: string;
  clientId: string;
  actorUserId: string;
  files: File[];
  kind?: AttachmentKind;
}): Promise<AttachmentRow[]> {
  const validFiles = input.files.filter((file) => file.size > 0);
  if (validFiles.length === 0) return [];
  if (validFiles.length > MAX_FILES) {
    throw new AttachmentUploadError(`Ajoutez ${MAX_FILES} fichiers maximum par commande.`);
  }

  const bucket = await ensureStorageBucket();
  const supabase = supabaseAdmin();
  const attachments = await collection<AttachmentRow>("attachments");
  const created: AttachmentRow[] = [];
  const uploadedPaths: string[] = [];
  const timestamp = nowIso();

  try {
    for (const file of validFiles) {
      validateFile(file);
      const id = newId();
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const safeName = safeFileName(file.name || "piece-jointe");
      const path = `workshops/${input.workshopId}/orders/${input.orderId}/${id}-${safeName}`;

      const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw new AttachmentUploadError(error.message);
      uploadedPaths.push(path);

      created.push({
        id,
        workshop_id: input.workshopId,
        order_id: input.orderId,
        order_item_id: null,
        client_id: input.clientId,
        kind: input.kind ?? "measurement_photo",
        bucket,
        storage_path: path,
        original_filename: file.name || safeName,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        checksum_sha256: checksum,
        uploaded_by: input.actorUserId,
        created_at: timestamp,
        deleted_at: null,
      });
    }

    await attachments.insertMany(created, { ordered: true });
    return created;
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((path) => supabase.storage.from(bucket).remove([path])));
    throw error;
  }
}

export async function listOrderAttachments(workshopId: string, orderId: string): Promise<AttachmentRow[]> {
  const attachments = await collection<AttachmentRow>("attachments");
  return attachments.find(
    { workshop_id: workshopId, order_id: orderId, deleted_at: null },
    { projection: { _id: 0 } },
  ).sort({ created_at: 1 }).toArray();
}

export async function listOrderAttachmentsWithUrls(
  workshopId: string,
  orderId: string,
): Promise<AttachmentWithUrl[]> {
  const rows = await listOrderAttachments(workshopId, orderId);
  const supabase = supabaseAdmin();

  return Promise.all(rows.map(async (row) => {
    const { data, error } = await supabase.storage
      .from(row.bucket)
      .createSignedUrl(row.storage_path, 60 * 30);
    return {
      ...row,
      signed_url: error ? null : data.signedUrl,
    };
  }));
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new AttachmentUploadError(`Le fichier ${file.name} depasse 8 Mo.`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AttachmentUploadError(`Le format du fichier ${file.name} n'est pas accepte.`);
  }
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return cleaned || "piece-jointe";
}
