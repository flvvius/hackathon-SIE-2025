import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Get the user's role in a specific group.
 * Returns the role if user is a member, null otherwise.
 */
export async function getUserRoleInGroup(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  groupId: Id<"groups">
): Promise<"owner" | "scrum_master" | "attendee" | null> {
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_group_and_user", (q) =>
      q.eq("groupId", groupId).eq("userId", userId)
    )
    .first();

  return membership?.role ?? null;
}

/**
 * Check if user has permission to create groups.
 * Returns true if user has the canCreateGroups flag set, or if the field is undefined (for backwards compatibility).
 */
export async function canUserCreateGroups(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  // Default to true if undefined (backwards compatibility for existing users)
  return user?.canCreateGroups !== false;
}

/**
 * Check if user is an owner in ANY group.
 * Useful for global permissions like viewing audit logs.
 */
export async function isUserOwnerAnywhere(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("role"), "owner"))
    .first();

  return memberships !== null;
}

/**
 * Require that the user has a specific role in a group.
 * Throws an error if the user doesn't have the required role.
 */
export async function requireRoleInGroup(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  groupId: Id<"groups">,
  requiredRole:
    | "owner"
    | "scrum_master"
    | "attendee"
    | ("owner" | "scrum_master")[]
): Promise<"owner" | "scrum_master" | "attendee"> {
  const role = await getUserRoleInGroup(ctx, userId, groupId);

  if (!role) {
    throw new Error("You are not a member of this group");
  }

  const allowedRoles = Array.isArray(requiredRole)
    ? requiredRole
    : [requiredRole];

  if (!allowedRoles.includes(role as any)) {
    throw new Error(`This action requires ${allowedRoles.join(" or ")} role`);
  }

  return role;
}

/**
 * Check if user has at least the minimum required role level.
 * Role hierarchy: owner > scrum_master > attendee
 */
export async function hasMinimumRole(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  groupId: Id<"groups">,
  minimumRole: "owner" | "scrum_master" | "attendee"
): Promise<boolean> {
  const role = await getUserRoleInGroup(ctx, userId, groupId);
  if (!role) return false;

  const roleHierarchy = {
    owner: 3,
    scrum_master: 2,
    attendee: 1,
  };

  return roleHierarchy[role] >= roleHierarchy[minimumRole];
}
