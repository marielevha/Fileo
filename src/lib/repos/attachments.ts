import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { ensureStorageBucket, supabaseAdmin } from "@/lib/supabase/admin";
import { sql, sqlOne, withPgTransaction, type PgExecutor } from "@/lib/supabase/postgres";

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
  measurement_record_id: string | null;
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
  attachmentId?: string;
}): Promise<AttachmentRow[]> {
  return uploadAttachments({
    workshopId: input.workshopId,
    actorUserId: input.actorUserId,
    files: input.files,
    fileIds: input.attachmentId ? [input.attachmentId] : undefined,
    kind: input.kind ?? "model_photo",
    orderId: input.orderId,
    clientId: input.clientId,
    storagePrefix: `orders/${input.orderId}`,
  });
}

export async function uploadMeasurementAttachments(input: {
  workshopId: string;
  clientId: string;
  measurementId: string;
  actorUserId: string;
  files: File[];
  attachmentId?: string;
}): Promise<AttachmentRow[]> {
  return uploadAttachments({
    workshopId: input.workshopId,
    actorUserId: input.actorUserId,
    files: input.files,
    fileIds: input.attachmentId ? [input.attachmentId] : undefined,
    kind: "measurement_photo",
    clientId: input.clientId,
    measurementRecordId: input.measurementId,
    storagePrefix: `clients/${input.clientId}/measurements/${input.measurementId}`,
  });
}

async function uploadAttachments(input: {
  workshopId: string;
  actorUserId: string;
  files: File[];
  fileIds?: string[];
  executor?: PgExecutor;
  kind: AttachmentKind;
  storagePrefix: string;
  clientId?: string | null;
  orderId?: string | null;
  measurementRecordId?: string | null;
}): Promise<AttachmentRow[]> {
  if (input.fileIds?.length === 1 && !input.executor) {
    return withPgTransaction(async (client) => {
      await sql("select pg_advisory_xact_lock(hashtext($1))", [input.fileIds![0]], client);
      return uploadAttachments({ ...input, executor: client });
    });
  }
  const validFiles = input.files.filter((file) => file.size > 0);
  if (validFiles.length === 0) return [];
  if (validFiles.length > MAX_FILES) {
    throw new AttachmentUploadError(`Ajoutez ${MAX_FILES} fichiers maximum à la fois.`);
  }

  const bucket = await ensureStorageBucket();
  const supabase = supabaseAdmin();
  const created: AttachmentRow[] = [];
  const returned: AttachmentRow[] = [];
  const uploadedPaths: string[] = [];
  const timestamp = new Date().toISOString();

  try {
    for (const [index, file] of validFiles.entries()) {
      const mimeType = fileMimeType(file);
      validateFile(file, mimeType);
      const id = input.fileIds?.[index] ?? randomUUID();
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const safeName = safeFileName(file.name || "piece-jointe");
      const path = `workshops/${input.workshopId}/${input.storagePrefix}/${id}-${safeName}`;

      if (input.fileIds) {
        const existing = await sqlOne<AttachmentRow>("select * from public.attachments where id=$1", [id], input.executor);
        if (existing) {
          if (existing.workshop_id !== input.workshopId || existing.order_id !== (input.orderId ?? null) ||
            existing.measurement_record_id !== (input.measurementRecordId ?? null) || existing.checksum_sha256 !== checksum ||
            existing.deleted_at) throw new AttachmentUploadError("Identifiant de piece jointe deja utilise.");
          returned.push(existing);
          continue;
        }
      }

      const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: mimeType,
        upsert: Boolean(input.fileIds),
      });
      if (error) throw new AttachmentUploadError(error.message);
      uploadedPaths.push(path);

      created.push({
        id,
        workshop_id: input.workshopId,
        order_id: input.orderId ?? null,
        order_item_id: null,
        measurement_record_id: input.measurementRecordId ?? null,
        client_id: input.clientId ?? null,
        kind: input.kind,
        bucket,
        storage_path: path,
        original_filename: file.name || safeName,
        mime_type: mimeType,
        size_bytes: file.size,
        checksum_sha256: checksum,
        uploaded_by: input.actorUserId,
        created_at: timestamp,
        deleted_at: null,
      });
    }

    for (const row of created) {
      await sql(`insert into public.attachments
        (id,workshop_id,order_id,order_item_id,measurement_record_id,client_id,kind,bucket,storage_path,original_filename,mime_type,size_bytes,checksum_sha256,uploaded_by,created_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        on conflict (id) do nothing`,[
        row.id,row.workshop_id,row.order_id,row.order_item_id,row.measurement_record_id,row.client_id,row.kind,row.bucket,row.storage_path,
        row.original_filename,row.mime_type,row.size_bytes,row.checksum_sha256,row.uploaded_by,row.created_at,
      ], input.executor);
    }
    return [...returned, ...created];
  } catch (error) {
    await Promise.allSettled(uploadedPaths.map((path) => supabase.storage.from(bucket).remove([path])));
    throw error;
  }
}

export async function listOrderAttachments(workshopId: string, orderId: string): Promise<AttachmentRow[]> {
  return sql<AttachmentRow>("select * from public.attachments where workshop_id=$1 and order_id=$2 and deleted_at is null order by created_at",[workshopId,orderId]);
}

export async function listOrderAttachmentsWithUrls(
  workshopId: string,
  orderId: string,
): Promise<AttachmentWithUrl[]> {
  return withSignedUrls(await listOrderAttachments(workshopId, orderId));
}

export async function listMeasurementAttachmentsWithUrls(
  workshopId: string,
  clientId: string,
): Promise<AttachmentWithUrl[]> {
  const rows = await sql<AttachmentRow>(`select * from public.attachments
    where workshop_id=$1 and client_id=$2 and measurement_record_id is not null and deleted_at is null
    order by created_at`, [workshopId, clientId]);
  return withSignedUrls(rows);
}

export async function deleteAttachment(input: {
  workshopId: string;
  attachmentId: string;
  orderId?: string;
  measurementId?: string;
}): Promise<boolean> {
  const parentClause = input.orderId
    ? "and order_id=$3"
    : input.measurementId
      ? "and measurement_record_id=$3"
      : "";
  const parentId = input.orderId ?? input.measurementId;
  const rows = await sql<AttachmentRow>(`update public.attachments set deleted_at=now()
    where workshop_id=$1 and id=$2 ${parentClause} and deleted_at is null returning *`,
    parentId ? [input.workshopId, input.attachmentId, parentId] : [input.workshopId, input.attachmentId]);
  const row = rows[0];
  if (!row) return false;
  const { error } = await supabaseAdmin().storage.from(row.bucket).remove([row.storage_path]);
  if (error) {
    await sql("update public.attachments set deleted_at=null where workshop_id=$1 and id=$2", [input.workshopId, input.attachmentId]);
    throw new AttachmentUploadError(error.message);
  }
  return true;
}

async function withSignedUrls(rows: AttachmentRow[]): Promise<AttachmentWithUrl[]> {
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

function validateFile(file: File, mimeType: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new AttachmentUploadError(`Le fichier ${file.name} depasse 8 Mo.`);
  }
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new AttachmentUploadError(`Le format du fichier ${file.name} n'est pas accepte.`);
  }
}

function fileMimeType(file: File) {
  const declared = file.type.toLowerCase();
  if (declared && declared !== "application/octet-stream") return declared === "image/jpg" ? "image/jpeg" : declared;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
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
