import { query } from "./_generated/server";
import { v } from "convex/values";
import { isUserOwnerAnywhere } from "./_lib/permissions";

export const listAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 100 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return [];
    }

    // Only users who are owners in at least one group can view all audit logs
    const isOwner = await isUserOwnerAnywhere(ctx, currentUser._id);
    if (!isOwner) {
      return [];
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return logs;
  },
});

export const listByGroup = query({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, limit = 100 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return [];
    }

    // Check if user is a member of the group
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", groupId).eq("userId", currentUser._id)
      )
      .unique();

    if (!membership) {
      return [];
    }

    // Only owners can view audit logs
    if (membership.role !== "owner") {
      return [];
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_group_and_timestamp", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(limit);

    return logs;
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      return [];
    }

    // Only owners in any group can view user-specific logs, or users viewing their own logs
    const isOwner = await isUserOwnerAnywhere(ctx, currentUser._id);
    if (!isOwner && currentUser._id !== userId) {
      return [];
    }

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return logs;
  },
});
