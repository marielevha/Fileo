import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import PlanningControls from "@/components/planning/PlanningControls";
import PlanningItemEditor from "@/components/planning/PlanningItemEditor";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { getDashboardCounts } from "@/lib/repos/dashboard";
import {
  listPlanningItems,
  listPlanningMembers,
  type PlanningItem,
  type PlanningStatusFilter,
} from "@/lib/repos/planning";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/repos/orders";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";

export const metadata: Metadata = {
  title: "Planning",
  robots: { index: false, follow: false },
};

type View = "liste" | "jour" | "semaine";
type QuickFilter = "aujourdhui" | "semaine" | "retard" | "pretes" | "";

type PlanningEvent = {
  id: string;
  date: string;
  kind: "item_due" | "promised" | "fitting" | "delivery";
  label: string;
  item: PlanningItem;
};

const EVENT_TONE: Record<PlanningEvent["kind"], string> = {
  item_due: "badge-info",
  promised: "badge-warning",
  fitting: "badge-secondary",
  delivery: "badge-success",
};

const STATUS_TONE: Record<ItemStatus, string> = {
  a_realiser: "badge-ghost",
  en_cours: "badge-info",
  a_essayer: "badge-warning",
  pret: "badge-success",
  remis: "badge-success",
  annule: "badge-error",
};

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    vue?: string;
    date?: string;
    q?: string;
    statut?: string;
    collaborateur?: string;
    filtre?: string;
    page?: string;
  }>;
}) {
  const { workshop } = await requireWorkshop("orders.read");
  const locale = await getLocale();
  const params = await searchParams;
  const today = todayIso();
  const selectedDate = isDate(params.date) ? params.date : today;
  const view: View = ["jour", "semaine"].includes(params.vue ?? "")
    ? params.vue as View
    : "liste";
  const quickFilter: QuickFilter = ["aujourdhui", "semaine", "retard", "pretes"].includes(params.filtre ?? "")
    ? params.filtre as QuickFilter
    : "";
  const rawStatus = params.statut ?? "active";
  const status: PlanningStatusFilter = quickFilter === "pretes"
    ? "pret"
    : rawStatus === "all" || rawStatus === "active" || ITEM_STATUSES.includes(rawStatus as ItemStatus)
      ? rawStatus as PlanningStatusFilter
      : "active";
  const assignee = params.collaborateur?.trim() || "all";
  const search = params.q?.trim() ?? "";
  const members = await listPlanningMembers(workshop.id);
  const memberIds = new Set(members.map((member) => member.id));
  const safeAssignee = assignee === "unassigned" || memberIds.has(assignee) ? assignee : "all";
  const items = await listPlanningItems(workshop.id, {
    search,
    status,
    assignee: safeAssignee,
  });
  const filteredItems = applyQuickFilter(items, quickFilter, today);
  const pageSize = 10;
  const requestedPage = parsePositiveInt(params.page) ?? 1;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const events = buildEvents(items);
  const counts = await getDashboardCounts(workshop.id);
  const listPath = localePath(locale, "/atelier/planning");
  const plainMembers = members.map((member) => ({ ...member }));
  const listQuery = new URLSearchParams();
  if (search) listQuery.set("q", search);
  if (status !== "active") listQuery.set("statut", status);
  if (safeAssignee !== "all") listQuery.set("collaborateur", safeAssignee);
  if (quickFilter) listQuery.set("filtre", quickFilter);

  const periodStart = view === "semaine" ? startOfWeek(selectedDate) : selectedDate;
  const periodEnd = view === "semaine" ? addDays(periodStart, 6) : selectedDate;
  const periodEvents = events.filter((event) => event.date >= periodStart && event.date <= periodEnd);
  const days = view === "semaine"
    ? Array.from({ length: 7 }, (_, index) => addDays(periodStart, index))
    : [selectedDate];
  const unscheduled = view === "liste"
    ? []
    : items.filter((item) => !item.effective_due_date && !item.fitting_date && !item.delivered_at);

  const statTiles = [
    { label: "À livrer aujourd'hui", value: counts.dueToday, filter: "aujourdhui", accent: "accent-1" },
    { label: "Sous 7 jours", value: counts.dueWithinSevenDays, filter: "semaine", accent: "accent-2" },
    { label: "En retard", value: counts.late, filter: "retard", accent: "accent-3" },
    { label: "Prêtes non remises", value: counts.readyNotDelivered, filter: "pretes", accent: "accent-2" },
  ];

  return (
    <>
      <PageHeader
        title="Planning"
        description="Organisez les échéances, les essayages et le travail de l'équipe."
        action={
          <Link href={localePath(locale, "/atelier/commandes")} className="btn btn-primary gap-2">
            Voir les commandes
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      />

      <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((tile) => (
          <li key={tile.filter} className={tile.accent}>
            <Link
              href={`${listPath}?filtre=${tile.filter}`}
              className="card-lift block rounded-2xl border border-base-300 bg-base-100 p-5"
            >
              <p className="font-display text-3xl font-extrabold text-[color:var(--accent)]">
                {tile.value}
              </p>
              <p className="mt-1 text-sm text-base-content/60">{tile.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <PlanningControls
        members={plainMembers}
        view={view}
        date={selectedDate}
        search={search}
        status={status}
        assignee={safeAssignee}
        quickFilter={quickFilter}
      />

      {view === "liste" ? (
        <PlanningList
          items={pagedItems}
          members={plainMembers}
          locale={locale}
          today={today}
          resetHref={listPath}
          pagination={{
            total: filteredItems.length,
            page: currentPage,
            pageSize,
            pageCount,
            href: (page) => pageHref(listPath, listQuery, page),
          }}
        />
      ) : (
        <CalendarView
          view={view}
          days={days}
          events={periodEvents}
          members={plainMembers}
          locale={locale}
          today={today}
        />
      )}

      {unscheduled.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display font-bold">Sans date ({unscheduled.length})</h2>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-base-300 bg-base-100 divide-y divide-base-300">
            {unscheduled.map((item) => (
              <li key={item.item_id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.description}</span>
                  <span className="block truncate text-sm text-base-content/55">
                    {item.client_name} · {item.reference}
                  </span>
                </span>
                <PlanningItemEditor item={{ ...item }} members={plainMembers} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PlanningList({
  items,
  members,
  locale,
  today,
  resetHref,
  pagination,
}: {
  items: PlanningItem[];
  members: Array<{ id: string; full_name: string }>;
  locale: "fr" | "en" | "lg";
  today: string;
  resetHref: string;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
    href: (page: number) => string;
  };
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-100 px-6 py-12 text-center">
        <p className="font-medium">Aucune tâche ne correspond à ces filtres.</p>
        <Link href={resetHref} className="btn btn-ghost btn-sm mt-4">Réinitialiser le planning</Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <div className="overflow-x-auto">
        <table className="table table-fixed">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[27%]" />
            <col className="w-[17%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Article</th>
              <th>Planification</th>
              <th>Collaborateur</th>
              <th>État</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const late = isLive(item.status) && Boolean(item.effective_due_date) && item.effective_due_date! < today;
              return (
                <tr key={item.item_id} className="align-middle hover:bg-base-200/70">
                  <td className="min-w-72 py-5">
                    <Link
                      href={localePath(locale, `/atelier/commandes/${item.order_id}`)}
                      className="line-clamp-2 font-medium leading-snug transition-colors hover:text-primary"
                    >
                      {item.description}
                    </Link>
                    <span className="mt-1 block text-sm leading-snug text-base-content/55">
                      {item.client_name} · {item.reference} · Qté {item.quantity}
                    </span>
                  </td>
                  <td className="min-w-64 py-5">
                    <DueDate item={item} late={late} />
                    {item.fitting_date ? (
                      <span className="mt-2 block text-sm leading-snug text-base-content/60">
                        Essayage · {formatDate(item.fitting_date, { day: "2-digit", month: "short" })}
                      </span>
                    ) : null}
                    {item.delivered_at ? (
                      <span className="mt-2 block text-sm leading-snug text-success">
                        Remise · {formatDate(item.delivered_at.slice(0, 10), { day: "2-digit", month: "short" })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-5 text-sm leading-snug">
                    {item.assignee_name ?? <span className="text-base-content/40">Non affecté</span>}
                  </td>
                  <td className="py-5"><StatusBadge status={item.status} /></td>
                  <td className="py-5 text-right">
                    <PlanningItemEditor item={{ ...item }} members={members} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">
          {pagination.total} tâche{pagination.total > 1 ? "s" : ""} - page {pagination.page} sur {pagination.pageCount}
        </p>
        <nav className="join" aria-label="Pagination du planning">
          <Link
            href={pagination.href(Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page === 1}
            className={`btn btn-sm join-item ${pagination.page === 1 ? "btn-disabled" : "btn-ghost"}`}
          >
            Précédent
          </Link>
          {visiblePages(pagination.page, pagination.pageCount).map((page) => (
            <Link
              key={page}
              href={pagination.href(page)}
              aria-current={page === pagination.page ? "page" : undefined}
              className={`btn btn-sm join-item ${page === pagination.page ? "btn-active" : "btn-ghost"}`}
            >
              {page}
            </Link>
          ))}
          <Link
            href={pagination.href(Math.min(pagination.pageCount, pagination.page + 1))}
            aria-disabled={pagination.page === pagination.pageCount}
            className={`btn btn-sm join-item ${pagination.page === pagination.pageCount ? "btn-disabled" : "btn-ghost"}`}
          >
            Suivant
          </Link>
        </nav>
      </div>
    </div>
  );
}

function CalendarView({
  view,
  days,
  events,
  members,
  locale,
  today,
}: {
  view: "jour" | "semaine";
  days: string[];
  events: PlanningEvent[];
  members: Array<{ id: string; full_name: string }>;
  locale: "fr" | "en" | "lg";
  today: string;
}) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold">
        {view === "jour"
          ? formatDate(days[0], { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : `Semaine du ${formatDate(days[0], { day: "numeric", month: "long" })} au ${formatDate(days[6], { day: "numeric", month: "long", year: "numeric" })}`}
      </h2>

      <div className={view === "semaine"
        ? "grid overflow-x-auto rounded-2xl border border-base-300 grid-cols-[repeat(7,minmax(9rem,1fr))]"
        : "overflow-hidden rounded-2xl border border-base-300"}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) => event.date === day);
          return (
            <article
              key={day}
              className={view === "semaine"
                ? "min-h-56 border-b border-r border-base-300 bg-base-100"
                : "bg-base-100"}
            >
              <header className={`border-b border-base-300 px-3.5 py-3 ${day === today ? "bg-primary/15" : "bg-base-200/60"}`}>
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-base-content/50">
                  {formatDate(day, { weekday: "short" })}
                </p>
                <p className={`mt-0.5 text-sm font-bold ${day === today ? "text-primary" : "text-base-content/80"}`}>
                  {formatDate(day, { day: "numeric", month: "short" })}
                </p>
              </header>

              {dayEvents.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-base-content/40">Aucun événement</p>
              ) : (
                <ul className="space-y-2 p-2.5">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <div className="rounded-lg border border-base-300 bg-base-200/50 p-2.5 transition-colors hover:bg-base-200">
                        <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className={`badge badge-xs w-fit whitespace-nowrap ${EVENT_TONE[event.kind]}`}>{eventLabel(event)}</span>
                          <Link
                            href={localePath(locale, `/atelier/commandes/${event.item.order_id}`)}
                            className="mt-1.5 block line-clamp-2 text-sm font-semibold leading-snug hover:text-primary"
                          >
                            {event.kind === "fitting" ? event.item.reference : event.item.description}
                          </Link>
                          <span className="mt-1 block line-clamp-2 text-xs leading-snug text-base-content/55">
                            {event.item.client_name}{event.kind === "fitting" ? "" : ` · ${event.item.reference}`}
                          </span>
                          {event.item.assignee_name ? (
                            <span className="mt-1.5 block truncate text-xs text-base-content/65">
                              {event.item.assignee_name}
                            </span>
                          ) : null}
                        </span>
                        {event.kind === "fitting" ? null : (
                          <PlanningItemEditor item={{ ...event.item }} members={members} compact />
                        )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DueDate({ item, late }: { item: PlanningItem; late: boolean }) {
  if (!item.effective_due_date) return <span className="text-base-content/40">Sans échéance</span>;
  return (
    <span className="block leading-snug">
      <span className={late ? "font-semibold text-error" : "text-base-content/75"}>
        {formatDate(item.effective_due_date, { day: "2-digit", month: "short", year: "numeric" })}
      </span>
      {late ? (
        <span className="mt-1 block text-xs font-semibold uppercase text-error/80">
          En retard
        </span>
      ) : null}
    </span>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`badge badge-sm min-w-24 justify-center whitespace-nowrap px-3 ${STATUS_TONE[status]}`}>
      {ITEM_STATUS_LABELS[status]}
    </span>
  );
}

function eventLabel(event: PlanningEvent): string {
  if (event.kind === "item_due") return "Échéance";
  if (event.kind === "promised") return "Promise";
  if (event.kind === "fitting") return "Essayage";
  return "Remise";
}

function buildEvents(items: PlanningItem[]): PlanningEvent[] {
  const events: PlanningEvent[] = [];
  const fittings = new Set<string>();

  for (const item of items) {
    if (item.effective_due_date) {
      events.push({
        id: `due-${item.item_id}`,
        date: item.effective_due_date,
        kind: item.explicit_due_date ? "item_due" : "promised",
        label: item.explicit_due_date ? "Échéance article" : "Date promise",
        item,
      });
    }
    if (item.fitting_date && !fittings.has(item.order_id)) {
      fittings.add(item.order_id);
      events.push({
        id: `fitting-${item.order_id}`,
        date: item.fitting_date,
        kind: "fitting",
        label: "Essayage",
        item,
      });
    }
    if (item.delivered_at) {
      events.push({
        id: `delivery-${item.item_id}`,
        date: item.delivered_at.slice(0, 10),
        kind: "delivery",
        label: "Remise effectuée",
        item,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

function applyQuickFilter(items: PlanningItem[], filter: QuickFilter, today: string) {
  if (filter === "aujourdhui") return items.filter((item) => item.effective_due_date === today);
  if (filter === "semaine") {
    const end = addDays(today, 7);
    return items.filter((item) => Boolean(item.effective_due_date) && item.effective_due_date! >= today && item.effective_due_date! <= end);
  }
  if (filter === "retard") {
    return items.filter((item) => isLive(item.status) && Boolean(item.effective_due_date) && item.effective_due_date! < today);
  }
  return items;
}

function parsePositiveInt(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pageHref(pathname: string, baseParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(baseParams);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function visiblePages(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 1, total - 2));
  const end = Math.min(total, start + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function isLive(status: ItemStatus) {
  return status !== "remis" && status !== "annule";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}
