import { getDashboardCounts, getDashboardMoney, getAgenda } from "@/lib/repos/dashboard";
import { isCurrencyCode } from "@/lib/money";
import { mobileHandler, ok, requireMobileSession, sessionPayload } from "@/lib/mobile/api";
import { listArticleTemplates } from "@/lib/repos/article-templates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const currency = isCurrencyCode(session.workshop.currency) ? session.workshop.currency : "XAF";
    const [counts, agenda, finance, articleTemplates] = await Promise.all([
      getDashboardCounts(session.workshop.id),
      getAgenda(session.workshop.id, 10),
      session.workshop.canViewMoney ? getDashboardMoney(session.workshop.id, currency) : Promise.resolve(null),
      listArticleTemplates(session.workshop.id),
    ]);

    return ok({
      ...sessionPayload(session),
      dashboard: { counts, agenda, finance },
      articleTemplates,
    });
  });
}
