import { isCurrencyCode } from "@/lib/money";
import { intParam, mobileHandler, ok, requireMobileSession, stringParam } from "@/lib/mobile/api";
import { listPaymentOrders, type PaymentOrderFilter } from "@/lib/repos/payments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "money.read");
    const url = new URL(request.url);
    const currency = isCurrencyCode(session.workshop.currency) ? session.workshop.currency : "XAF";
    const filter = stringParam(url, "filter", "all") as PaymentOrderFilter;
    const page = await listPaymentOrders(session.workshop.id, {
      currency,
      filter,
      search: stringParam(url, "q"),
      page: intParam(url, "page", 1, 1, 10_000),
      pageSize: intParam(url, "pageSize", 20, 1, 50),
    });
    return ok(page);
  });
}
