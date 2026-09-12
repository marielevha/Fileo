import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import { AddMemberForm, TeamMemberEditor } from "@/components/team/TeamForms";
import TeamControls from "@/components/team/TeamControls";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";
import {
  listTeamMembers,
  type TeamFilter,
  type TeamMemberRow,
} from "@/lib/repos/team";

export const metadata: Metadata = {
  title: "Équipe",
  robots: { index: false, follow: false },
};

const FILTERS: TeamFilter[] = ["all", "active", "owners", "money", "disabled"];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string; page?: string }>;
}) {
  const { user, workshop } = await requireWorkshop("team.manage");
  const locale = await getLocale();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const filter: TeamFilter = FILTERS.includes(params.filtre as TeamFilter)
    ? params.filtre as TeamFilter
    : "all";
  const page = parsePositiveInt(params.page) ?? 1;
  const result = await listTeamMembers(workshop.id, { search, filter, page, pageSize: 10 });
  const { members, stats, planUsage } = result;
  const teamPath = localePath(locale, "/atelier/equipe");
  const baseQuery = new URLSearchParams();
  if (search) baseQuery.set("q", search);
  if (filter !== "all") baseQuery.set("filtre", filter);

  const statTiles = [
    { label: "Membres actifs", value: stats.active, href: `${teamPath}?filtre=active`, accent: "accent-1" },
    { label: "Responsables", value: stats.owners, href: `${teamPath}?filtre=owners`, accent: "accent-2" },
    { label: "Accès financier", value: stats.moneyAccess, href: `${teamPath}?filtre=money`, accent: "accent-2" },
    {
      label: planUsage.memberLimit === null ? "Places disponibles" : `Places disponibles / ${planUsage.memberLimit}`,
      value: planUsage.remainingSlots ?? "Illimité",
      href: teamPath,
      accent: "accent-3",
    },
  ];

  return (
    <>
      <PageHeader
        title="Équipe"
        description="Gérez les rôles, les accès financiers et la charge de travail des membres."
        action={
          <Link href={localePath(locale, "/atelier/planning")} className="btn btn-primary gap-2">
            Voir le planning
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      />

      <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((tile) => (
          <li key={tile.label} className={tile.accent}>
            <Link
              href={tile.href}
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

      <div className="mb-6">
        <AddMemberForm
          limitReached={planUsage.limitReached}
          usageLabel={teamUsageLabel(planUsage)}
        />
      </div>

      {planUsage.limitExceeded ? (
        <p className="alert alert-warning mb-6 py-3 text-sm">
          <Icon name="shield" className="h-5 w-5" />
          Cet atelier dépasse la limite de son abonnement. Désactivez des membres ou passez sur une offre supérieure.
        </p>
      ) : null}

      <TeamControls search={search} filter={filter} />

      {members.length === 0 ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 px-6 py-12 text-center">
          <p className="font-medium">Aucun membre ne correspond à ces filtres.</p>
          <Link href={teamPath} className="btn btn-ghost btn-sm mt-4">Réinitialiser l&apos;équipe</Link>
        </div>
      ) : (
        <TeamTable
          members={members}
          currentUserId={user.id}
          pagination={{
            total: result.total,
            page: result.page,
            pageCount: result.pageCount,
            href: (nextPage) => pageHref(teamPath, baseQuery, nextPage),
          }}
        />
      )}
    </>
  );
}

function teamUsageLabel(usage: {
  planLabel: string | null;
  memberLimit: number | null;
  activeMembers: number;
  remainingSlots: number | null;
}) {
  const plan = usage.planLabel ?? "Abonnement actuel";
  if (usage.memberLimit === null) {
    return `${plan} · ${usage.activeMembers} membres actifs · limite illimitée.`;
  }
  return `${plan} · ${usage.activeMembers}/${usage.memberLimit} membres actifs · ${usage.remainingSlots} place${usage.remainingSlots && usage.remainingSlots > 1 ? "s" : ""} disponible${usage.remainingSlots && usage.remainingSlots > 1 ? "s" : ""}.`;
}

function TeamTable({
  members,
  currentUserId,
  pagination,
}: {
  members: TeamMemberRow[];
  currentUserId: string;
  pagination: {
    total: number;
    page: number;
    pageCount: number;
    href: (page: number) => string;
  };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <div className="overflow-x-auto">
        <table className="table table-fixed">
          <colgroup>
            <col className="w-[31%]" />
            <col className="w-[17%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th>Accès</th>
              <th>Charge</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.membership_id} className="align-middle hover:bg-base-200/70">
                <td className="min-w-64 py-5">
                  <span className="line-clamp-2 font-medium leading-snug">
                    {member.full_name}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-base-content/55">
                    {member.phone_e164}
                  </span>
                  {member.email ? (
                    <span className="mt-1 block truncate text-sm text-base-content/45">{member.email}</span>
                  ) : null}
                </td>
                <TeamMemberEditor member={member} currentUserId={currentUserId} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">
          {pagination.total} membre{pagination.total > 1 ? "s" : ""} - page {pagination.page} sur {pagination.pageCount}
        </p>
        <nav className="join" aria-label="Pagination de l'équipe">
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
