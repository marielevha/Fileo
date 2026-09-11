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
  const events = buildEvents(items);
  const counts = await getDashboardCounts(workshop.id);
  const listPath = localePath(locale, "/atelier/planning");
  const plainMembers = members.map((member) => ({ ...member }));

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
          items={filteredItems}
          members={plainMembers}
          locale={locale}
          today={today}
          resetHref={listPath}
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
}: {
  items: PlanningItem[];
  members: Array<{ id: string; full_name: string }>;
  locale: "fr" | "en" | "lg";
  today: string;
  resetHref: string;
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
        <table className="table">
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
                <tr key={item.item_id} className="hover:bg-base-200">
                  <td className="min-w-56">
                    <Link
                      href={localePath(locale, `/atelier/commandes/${item.order_id}`)}
                      className="font-medium transition-colors hover:text-primary"
                    >
                      {item.description}
                    </Link>
                    <span className="mt-0.5 block text-sm text-base-content/55">
                      {item.client_name} · {item.reference} · Qté {item.quantity}
                    </span>
                  </td>
                  <td className="min-w-48 text-sm">
                    <DueDate item={item} late={late} />
                    {item.fitting_date ? (
                      <span className="mt-1 block text-base-content/60">
                        Essayage · {formatDate(item.fitting_date, { day: "2-digit", month: "short" })}
                      </span>
                    ) : null}
                    {item.delivered_at ? (
                      <span className="mt-1 block text-success">
                        Remise · {formatDate(item.delivered_at.slice(0, 10), { day: "2-digit", month: "short" })}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sm">
                    {item.assignee_name ?? <span className="text-base-content/40">Non affecté</span>}
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-right">
                    <PlanningItemEditor item={{ ...item }} members={members} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        ? "grid overflow-hidden rounded-2xl border border-base-300 md:grid-cols-7"
        : "overflow-hidden rounded-2xl border border-base-300"}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) => event.date === day);
          return (
            <article
              key={day}
              className={view === "semaine"
                ? "min-h-44 border-b border-r border-base-300 bg-base-100"
                : "bg-base-100"}
            >
              <header className={`border-b border-base-300 px-3 py-2.5 ${day === today ? "bg-primary/10" : "bg-base-200/60"}`}>
                <p className="text-xs font-semibold uppercase text-base-content/55">
                  {formatDate(day, { weekday: "short" })}
                </p>
                <p className={day === today ? "font-bold text-primary" : "font-semibold"}>
                  {formatDate(day, { day: "numeric", month: "short" })}
                </p>
              </header>

              {dayEvents.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-base-content/40">Aucun événement</p>
              ) : (
                <ul className="divide-y divide-base-300">
                  {dayEvents.map((event) => (
                    <li key={event.id} className="p-3">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className={`badge badge-xs ${EVENT_TONE[event.kind]}`}>{event.label}</span>
                          <Link
                            href={localePath(locale, `/atelier/commandes/${event.item.order_id}`)}
                            className="mt-1.5 block text-sm font-medium leading-snug hover:text-primary"
                          >
                            {event.kind === "fitting" ? event.item.reference : event.item.description}
                          </Link>
                          <span className="mt-0.5 block truncate text-xs text-base-content/55">
                            {event.item.client_name}{event.kind === "fitting" ? "" : ` · ${event.item.reference}`}
                          </span>
                          {event.item.assignee_name ? (
                            <span className="mt-1 block truncate text-xs text-base-content/60">
                              {event.item.assignee_name}
                            </span>
                          ) : null}
                        </span>
                        {event.kind === "fitting" ? null : (
                          <PlanningItemEditor item={{ ...event.item }} members={members} compact />
                        )}
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
    <span className={late ? "font-medium text-error" : "text-base-content/70"}>
      <span className={`badge badge-xs mr-1.5 ${item.explicit_due_date ? "badge-info" : "badge-warning"}`}>
        {item.explicit_due_date ? "Échéance" : "Date promise"}
      </span>
      {late ? "En retard · " : ""}
      {formatDate(item.effective_due_date, { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`badge badge-sm ${STATUS_TONE[status]}`}>{ITEM_STATUS_LABELS[status]}</span>;
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
