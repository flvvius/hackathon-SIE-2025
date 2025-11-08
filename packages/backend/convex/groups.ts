import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return [];
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const groups: any[] = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (g) groups.push(g);
    }
    return groups;
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");
    const now = Date.now();
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      creatorId: me._id,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: me._id,
      role: "owner",
      joinedAt: now,
    } as any);

    // Create default statuses: To Do, In Progress, Done
    const statuses = [
      { name: "To Do", color: "#64748b" },
      { name: "In Progress", color: "#f59e0b" },
      { name: "Done", color: "#10b981" },
    ];
    for (let i = 0; i < statuses.length; i++) {
      const s = statuses[i];
      await ctx.db.insert("taskStatuses", {
        groupId,
        name: s.name,
        order: i,
        color: s.color,
        isDefault: true,
        createdAt: now,
      });
    }

    return await ctx.db.get(groupId);
  },
});

export const groupMembersList = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return members;
  },
});
