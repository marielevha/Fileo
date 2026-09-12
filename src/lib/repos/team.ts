import "server-only";

import type { ClientSession } from "mongodb";
import { recordAudit } from "@/lib/audit";
import { collection, fromBool, newId, nowIso, toBool, withTransaction } from "@/lib/db";
import { parseLimits } from "@/lib/repos/contents";
import { getCurrentSubscription } from "@/lib/repos/subscriptions";
import type { WorkshopRole } from "@/lib/permissions";

export type TeamStatus = "active" | "disabled" | "invited";
export type TeamFilter = "all" | "active" | "money" | "disabled" | "owners";

export type TeamMemberRow = {
  membership_id: string;
  user_id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  role: WorkshopRole;
  can_view_money: boolean;
  status: TeamStatus;
  invited_at: string | null;
  created_at: string;
  assigned_items: number;
};

export type TeamStats = {
  total: number;
  active: number;
  owners: number;
  moneyAccess: number;
  disabled: number;
  assignedItems: number;
};

export type TeamPlanUsage = {
  planLabel: string | null;
  subscriptionStatus: string | null;
  memberLimit: number | null;
  activeMembers: number;
  remainingSlots: number | null;
  limitReached: boolean;
  limitExceeded: boolean;
};

export type TeamPage = {
  members: TeamMemberRow[];
  stats: TeamStats;
  planUsage: TeamPlanUsage;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listTeamMembers(
  workshopId: string,
  options: { search?: string; filter?: TeamFilter; page?: number; pageSize?: number } = {},
): Promise<TeamPage> {
  const memberships = await collection("memberships");
  const rows = await memberships.aggregate<TeamMemberRow>([
    { $match: { workshop_id: workshopId } },
    { $lookup: { from: "users", localField: "user_id", foreignField: "id", as: "user" } },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "order_items",
        let: { uid: "$user_id", wid: "$workshop_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$workshop_id", "$$wid"] },
                  { $eq: ["$assignee_user_id", "$$uid"] },
                  { $not: { $in: ["$status", ["remis", "annule"]] } },
                ],
              },
            },
          },
          { $count: "total" },
        ],
        as: "assigned",
      },
    },
    {
      $project: {
        _id: 0,
        membership_id: "$id",
        user_id: 1,
        full_name: "$user.full_name",
        phone_e164: "$user.phone_e164",
        email: { $ifNull: ["$user.email", null] },
        role: 1,
        can_view_money: { $toBool: "$can_view_money" },
        status: 1,
        invited_at: { $ifNull: ["$invited_at", null] },
        created_at: 1,
        assigned_items: { $ifNull: [{ $first: "$assigned.total" }, 0] },
      },
    },
    { $sort: { role: -1, status: 1, full_name: 1 } },
  ]).toArray();

  const filtered = rows
    .map(normaliseMember)
    .filter((member) => matchesSearch(member, options.search ?? ""))
    .filter((member) => matchesFilter(member, options.filter ?? "all"));
  const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize ?? 10)));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(options.page ?? 1)));

  return {
    members: filtered.slice((page - 1) * pageSize, page * pageSize),
    stats: buildStats(rows.map(normaliseMember)),
    planUsage: await getTeamPlanUsage(workshopId),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
  };
}

export async function addExistingMember(input: {
  workshopId: string;
  actorUserId: string;
  phoneE164: string;
  role: WorkshopRole;
  canViewMoney: boolean;
}): Promise<void> {
  await withTransaction(async (session) => {
    const users = await collection("users");
    const memberships = await collection("memberships");
    const usage = await getTeamPlanUsage(input.workshopId, session);
    const user = await users.findOne(
      { phone_e164: input.phoneE164, status: "active" },
      { projection: { id: 1, full_name: 1 }, session },
    );
    if (!user) throw new TeamError("Aucun compte actif ne correspond à ce numéro.");
    const existing = await memberships.findOne(
      { workshop_id: input.workshopId, user_id: user.id },
      { session },
    );
    if (existing) {
      if (existing.status === "active") throw new TeamError("Ce membre fait déjà partie de l'atelier.");
      assertMemberLimitAllowsActivation(usage);
      await memberships.updateOne(
        { id: existing.id },
        {
          $set: {
            role: input.role,
            can_view_money: fromBool(input.role === "owner" || input.canViewMoney),
            status: "active",
            updated_at: nowIso(),
          },
          $inc: { row_version: 1 },
        },
        { session },
      );
      await recordAudit({
        workshopId: input.workshopId,
        actorUserId: input.actorUserId,
        action: "member.permissions",
        entityKind: "membership",
        entityId: String(existing.id),
        before: { status: existing.status, role: existing.role, canViewMoney: toBool(existing.can_view_money) },
        after: { status: "active", role: input.role, canViewMoney: input.role === "owner" || input.canViewMoney },
      }, session);
      return;
    }

    assertMemberLimitAllowsActivation(usage);
    const membershipId = newId();
    await memberships.insertOne({
      id: membershipId,
      workshop_id: input.workshopId,
      user_id: user.id,
      role: input.role,
      can_view_money: fromBool(input.role === "owner" || input.canViewMoney),
      status: "active",
      invited_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      row_version: 1,
    }, { session });
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "member.invite",
      entityKind: "membership",
      entityId: membershipId,
      after: { userId: user.id, role: input.role, canViewMoney: input.role === "owner" || input.canViewMoney },
    }, session);
  });
}

export async function updateTeamMember(input: {
  workshopId: string;
  actorUserId: string;
  membershipId: string;
  role: WorkshopRole;
  status: TeamStatus;
  canViewMoney: boolean;
}): Promise<void> {
  await withTransaction(async (session) => {
    const memberships = await collection("memberships");
    const member = await memberships.findOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      { session },
    );
    if (!member) throw new TeamError("Membre introuvable dans cet atelier.");
    if (member.user_id === input.actorUserId && input.status !== "active") {
      throw new TeamError("Vous ne pouvez pas désactiver votre propre accès.");
    }
    if (member.user_id === input.actorUserId && input.role !== "owner") {
      throw new TeamError("Vous ne pouvez pas retirer votre propre rôle responsable.");
    }
    const owners = await memberships.countDocuments({
      workshop_id: input.workshopId,
      role: "owner",
      status: "active",
    }, { session });
    if (member.role === "owner" && input.role !== "owner" && owners <= 1) {
      throw new TeamError("L'atelier doit conserver au moins un responsable actif.");
    }
    if (member.role === "owner" && input.status !== "active" && owners <= 1) {
      throw new TeamError("L'atelier doit conserver au moins un responsable actif.");
    }
    if (member.status !== "active" && input.status === "active") {
      assertMemberLimitAllowsActivation(await getTeamPlanUsage(input.workshopId, session));
    }

    const nextMoney = input.role === "owner" || input.canViewMoney;
    await memberships.updateOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      {
        $set: {
          role: input.role,
          status: input.status,
          can_view_money: fromBool(nextMoney),
          updated_at: nowIso(),
        },
        $inc: { row_version: 1 },
      },
      { session },
    );
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: input.status === "disabled" ? "member.disable" : "member.permissions",
      entityKind: "membership",
      entityId: input.membershipId,
      before: { role: member.role, status: member.status, canViewMoney: toBool(member.can_view_money) },
      after: { role: input.role, status: input.status, canViewMoney: nextMoney },
    }, session);
  });
}

export async function toggleTeamMemberStatus(input: {
  workshopId: string;
  actorUserId: string;
  membershipId: string;
  active: boolean;
}): Promise<void> {
  await withTransaction(async (session) => {
    const memberships = await collection("memberships");
    const member = await memberships.findOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      { session },
    );
    if (!member) throw new TeamError("Membre introuvable dans cet atelier.");
    if (member.user_id === input.actorUserId) {
      throw new TeamError("Vous ne pouvez pas modifier votre propre accès.");
    }
    if (!input.active && member.role === "owner" && member.status === "active") {
      const owners = await memberships.countDocuments({
        workshop_id: input.workshopId,
        role: "owner",
        status: "active",
      }, { session });
      if (owners <= 1) throw new TeamError("L'atelier doit conserver au moins un responsable actif.");
    }
    if (input.active && member.status !== "active") {
      assertMemberLimitAllowsActivation(await getTeamPlanUsage(input.workshopId, session));
    }

    const nextStatus: TeamStatus = input.active ? "active" : "disabled";
    await memberships.updateOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      {
        $set: {
          status: nextStatus,
          updated_at: nowIso(),
          ...(input.active ? {} : { can_view_money: 0 }),
        },
        $inc: { row_version: 1 },
      },
      { session },
    );
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: nextStatus === "disabled" ? "member.disable" : "member.permissions",
      entityKind: "membership",
      entityId: input.membershipId,
      before: { status: member.status, canViewMoney: toBool(member.can_view_money) },
      after: { status: nextStatus, canViewMoney: input.active ? toBool(member.can_view_money) : false },
    }, session);
  });
}

export async function removeTeamMember(input: {
  workshopId: string;
  actorUserId: string;
  membershipId: string;
}): Promise<void> {
  await withTransaction(async (session) => {
    const memberships = await collection("memberships");
    const member = await memberships.findOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      { session },
    );
    if (!member) throw new TeamError("Membre introuvable dans cet atelier.");
    if (member.user_id === input.actorUserId) {
      throw new TeamError("Vous ne pouvez pas retirer votre propre accès.");
    }
    const owners = await memberships.countDocuments({
      workshop_id: input.workshopId,
      role: "owner",
      status: "active",
    }, { session });
    if (member.role === "owner" && member.status === "active" && owners <= 1) {
      throw new TeamError("L'atelier doit conserver au moins un responsable actif.");
    }

    await memberships.updateOne(
      { id: input.membershipId, workshop_id: input.workshopId },
      {
        $set: {
          status: "disabled",
          can_view_money: 0,
          updated_at: nowIso(),
        },
        $inc: { row_version: 1 },
      },
      { session },
    );
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "member.disable",
      entityKind: "membership",
      entityId: input.membershipId,
      before: { role: member.role, status: member.status, canViewMoney: toBool(member.can_view_money) },
      after: { role: member.role, status: "disabled", canViewMoney: false },
    }, session);
  });
}

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamError";
  }
}

function normaliseMember(member: TeamMemberRow): TeamMemberRow {
  return {
    ...member,
    role: member.role === "owner" ? "owner" : "collaborator",
    status: ["active", "disabled", "invited"].includes(member.status) ? member.status : "disabled",
    can_view_money: Boolean(member.can_view_money),
    assigned_items: Number(member.assigned_items ?? 0),
  };
}

function matchesSearch(member: TeamMemberRow, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${member.full_name} ${member.phone_e164} ${member.email ?? ""}`.toLowerCase().includes(term);
}

function matchesFilter(member: TeamMemberRow, filter: TeamFilter) {
  if (filter === "active") return member.status === "active";
  if (filter === "money") return member.can_view_money;
  if (filter === "disabled") return member.status === "disabled";
  if (filter === "owners") return member.role === "owner";
  return true;
}

function buildStats(members: TeamMemberRow[]): TeamStats {
  return members.reduce<TeamStats>((stats, member) => {
    stats.total += 1;
    stats.active += member.status === "active" ? 1 : 0;
    stats.owners += member.role === "owner" ? 1 : 0;
    stats.moneyAccess += member.can_view_money ? 1 : 0;
    stats.disabled += member.status === "disabled" ? 1 : 0;
    stats.assignedItems += member.assigned_items;
    return stats;
  }, { total: 0, active: 0, owners: 0, moneyAccess: 0, disabled: 0, assignedItems: 0 });
}

export async function getTeamPlanUsage(
  workshopId: string,
  session?: ClientSession,
): Promise<TeamPlanUsage> {
  const memberships = await collection("memberships");
  const plans = await collection("plans");
  const [activeMembers, subscription] = await Promise.all([
    memberships.countDocuments({ workshop_id: workshopId, status: "active" }, { session }),
    getCurrentSubscription(workshopId, session),
  ]);
  const plan = subscription
    ? await plans.findOne(
        { id: subscription.plan_id },
        { projection: { label: 1, limits_json: 1 }, session },
      )
    : null;
  const memberLimit = plan?.limits_json ? parseLimits(String(plan.limits_json)).members : null;
  const remainingSlots = memberLimit === null ? null : Math.max(memberLimit - activeMembers, 0);

  return {
    planLabel: plan?.label ? String(plan.label) : null,
    subscriptionStatus: subscription?.status ? String(subscription.status) : null,
    memberLimit,
    activeMembers,
    remainingSlots,
    limitReached: memberLimit !== null && activeMembers >= memberLimit,
    limitExceeded: memberLimit !== null && activeMembers > memberLimit,
  };
}

function assertMemberLimitAllowsActivation(usage: TeamPlanUsage): void {
  if (usage.memberLimit === null) return;
  if (usage.activeMembers >= usage.memberLimit) {
    throw new TeamError(
      `Limite d'abonnement atteinte : ${usage.activeMembers}/${usage.memberLimit} membres actifs.`,
    );
  }
}
