import { createClient } from "@/lib/repos/clients";
import {
  createOrder,
  getOrder,
  listOrdersPage,
  OrderWriteError,
  type CreateOrderItemInput,
  type InitialPaymentMethod,
  type OrderFilter,
  type OrderItemWorkType,
} from "@/lib/repos/orders";
import { isCurrencyCode, money } from "@/lib/money";
import {
  created,
  intParam,
  integerAmount,
  mobileHandler,
  MobileApiError,
  ok,
  optionalDate,
  optionalString,
  parseJsonBody,
  requireMobileSession,
  requiredString,
  stringParam,
} from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type CreateOrderBody = {
  clientId?: string;
  client?: { displayName?: string; phone?: string | null };
  promisedDate?: string | null;
  fittingDate?: string | null;
  instructions?: string | null;
  orderTotalAmount?: number;
  discountAmount?: number;
  discountReason?: string | null;
  items?: Array<{
    category?: string;
    description?: string;
    workType?: OrderItemWorkType;
    wearerName?: string | null;
    wearerRelation?: string | null;
    quantity?: number;
    unitPriceAmount?: number;
    dueDate?: string | null;
    measurementValues?: Record<string, string>;
    measurementNotes?: string | null;
  }>;
  initialPayment?: {
    amount?: number;
    method?: InitialPaymentMethod;
    reference?: string | null;
    effectiveDate?: string;
    idempotencyKey?: string;
  } | null;
};

const WORK_TYPES: OrderItemWorkType[] = ["creation", "retouche"];
const METHODS: InitialPaymentMethod[] = ["cash", "mobile_money", "transfer", "other"];

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const url = new URL(request.url);
    const rawFilter = stringParam(url, "filter", "all");
    const filters: OrderFilter[] = ["all", "late", "nouvelle", "en_cours", "prete", "partiellement_remise", "remise", "annulee"];
    const page = await listOrdersPage(session.workshop.id, {
      includeMoney: session.workshop.canViewMoney,
      search: stringParam(url, "q"),
      filter: filters.includes(rawFilter as OrderFilter) ? rawFilter as OrderFilter : "all",
      page: intParam(url, "page", 1, 1, 10_000),
      pageSize: intParam(url, "pageSize", 20, 1, 50),
    });
    return ok(page);
  });
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    if (!isCurrencyCode(session.workshop.currency)) {
      throw new MobileApiError(400, "validation_error", "Devise atelier invalide.");
    }
    const body = await parseJsonBody<CreateOrderBody>(request);
    const clientId = await resolveClientId(body, session);
    const items = parseItems(body, session.workshop.currency, session.workshop.canViewMoney);

    if (session.workshop.canViewMoney) {
      const orderTotal = integerAmount(body.orderTotalAmount ?? 0, "Total commande");
      const itemTotal = items.reduce((total, item) => total + item.unitPrice.amount * item.quantity, 0);
      if (itemTotal === 0 && orderTotal > 0) {
        items[0] = { ...items[0], unitPrice: money(orderTotal, session.workshop.currency) };
      }
    }

    let initialPayment: Parameters<typeof createOrder>[0]["initialPayment"] = null;
    if (body.initialPayment && session.workshop.canViewMoney) {
      const method = body.initialPayment.method ?? "cash";
      if (!METHODS.includes(method)) throw new MobileApiError(400, "validation_error", "Moyen d'encaissement invalide.");
      const effectiveDate = optionalDate(body.initialPayment.effectiveDate, "Date d'acompte");
      if (!effectiveDate) throw new MobileApiError(400, "validation_error", "Date d'acompte obligatoire.");
      initialPayment = {
        amount: money(integerAmount(body.initialPayment.amount, "Acompte"), session.workshop.currency),
        method,
        reference: optionalString(body.initialPayment.reference, 120),
        effectiveDate,
        idempotencyKey: requiredString(body.initialPayment.idempotencyKey, "Cle d'idempotence", 128),
      };
    }

    try {
      const result = await createOrder({
        workshopId: session.workshop.id,
        actorUserId: session.user.id,
        clientId,
        currency: session.workshop.currency,
        discount: money(session.workshop.canViewMoney ? integerAmount(body.discountAmount ?? 0, "Reduction") : 0, session.workshop.currency),
        discountReason: optionalString(body.discountReason, 160),
        instructions: optionalString(body.instructions, 2000),
        promisedDate: optionalDate(body.promisedDate, "Date promise"),
        fittingDate: optionalDate(body.fittingDate, "Date d'essayage"),
        items,
        initialPayment,
      });
      const summary = await getOrder(session.workshop.id, result.orderId, session.workshop.canViewMoney);
      return created({ ...result, order: summary });
    } catch (error) {
      if (error instanceof OrderWriteError) {
        throw new MobileApiError(400, "order_write_error", error.message);
      }
      throw error;
    }
  });
}

async function resolveClientId(body: CreateOrderBody, session: Awaited<ReturnType<typeof requireMobileSession>>) {
  const clientId = optionalString(body.clientId, 80);
  if (clientId) return clientId;
  if (!body.client) throw new MobileApiError(400, "validation_error", "Client obligatoire.");
  const displayName = requiredString(body.client.displayName, "Nom du client", 120);
  let phoneE164: string | null = null;
  const rawPhone = optionalString(body.client.phone, 40);
  if (rawPhone) {
    if (!isCountryCode(session.workshop.countryCode)) throw new MobileApiError(400, "validation_error", "Pays atelier invalide.");
    const phone = parsePhone(rawPhone, session.workshop.countryCode);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
    phoneE164 = phone.e164;
  }
  return createClient({
    workshopId: session.workshop.id,
    actorUserId: session.user.id,
    displayName,
    phoneE164,
  });
}

function parseItems(body: CreateOrderBody, currency: string, canViewMoney: boolean): CreateOrderItemInput[] {
  if (!isCurrencyCode(currency)) throw new MobileApiError(400, "validation_error", "Devise invalide.");
  const rows = body.items ?? [];
  if (rows.length === 0) throw new MobileApiError(400, "validation_error", "Ajoutez au moins un article.");
  return rows.map((item, index) => {
    const workType = item.workType ?? "creation";
    if (!WORK_TYPES.includes(workType)) {
      throw new MobileApiError(400, "validation_error", `Type de travail invalide ligne ${index + 1}.`);
    }
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new MobileApiError(400, "validation_error", `Quantite invalide ligne ${index + 1}.`);
    }
    return {
      category: requiredString(item.category, `Article ligne ${index + 1}`, 80),
      description: requiredString(item.description, `Description ligne ${index + 1}`, 500),
      workType,
      wearerName: optionalString(item.wearerName, 120),
      wearerRelation: optionalString(item.wearerRelation, 80),
      quantity,
      unitPrice: money(canViewMoney ? integerAmount(item.unitPriceAmount ?? 0, `Prix ligne ${index + 1}`) : 0, currency),
      dueDate: optionalDate(item.dueDate, `Echeance ligne ${index + 1}`),
      measurementValues: item.measurementValues ?? {},
      measurementNotes: optionalString(item.measurementNotes, 1000),
    };
  });
}
