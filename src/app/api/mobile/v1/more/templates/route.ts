import { deleteArticleTemplate, listArticleTemplates, saveArticleTemplate, type MeasurementTemplateField } from "@/lib/repos/article-templates";
import { mobileHandler, ok, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

type TemplatePayload = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  defaultWorkType?: unknown;
  active?: unknown;
  sortOrder?: unknown;
  fields?: unknown;
};

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "templates.manage");
    const templates = await listArticleTemplates(session.workshop.id, { includeInactive: true });
    return ok({ items: templates });
  });
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "templates.manage");
    const body = await parseJsonBody<TemplatePayload>(request);
    const id = await saveArticleTemplate({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      name: requiredString(body.name, "Nom du modele", 80),
      description: optionalText(body.description, 180),
      defaultWorkType: parseWorkType(body.defaultWorkType),
      active: body.active !== false,
      sortOrder: integer(body.sortOrder, 0),
      fields: parseFields(body.fields),
    });
    return ok({ id });
  });
}

export async function DELETE(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "templates.manage");
    const body = await parseJsonBody<{ id?: unknown }>(request);
    const id = requiredString(body.id, "Modele", 80);
    await deleteArticleTemplate({ workshopId: session.workshop.id, actorUserId: session.user.id, id });
    return ok({ deleted: true });
  });
}

function parseFields(value: unknown): MeasurementTemplateField[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const label = String(source.label ?? "").trim().slice(0, 80);
    const unit = String(source.unit ?? "cm").trim().toLowerCase().slice(0, 12) || "cm";
    return label ? {
      key: keyFor(label, index),
      label,
      unit,
      required: Boolean(source.required),
      sortOrder: index + 1,
    } : null;
  }).filter((field): field is MeasurementTemplateField => Boolean(field));
}

function parseWorkType(value: unknown): "creation" | "retouche" {
  return value === "retouche" ? "retouche" : "creation";
}

function integer(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) ? Math.max(0, parsed) : fallback;
}

function optionalText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function keyFor(label: string, index: number) {
  return label.toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || `mesure_${index + 1}`;
}
