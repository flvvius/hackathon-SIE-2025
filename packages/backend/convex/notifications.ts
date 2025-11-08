import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const myNotifications = query({
  args: { onlyUnread: v.optional(v.boolean()) },
  handler: async (ctx, { onlyUnread }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return [];
    let q = ctx.db
      .query("notifications")
      .withIndex("by_user", (qi: any) => qi.eq("userId", me._id));
    let list = await q.collect();
    if (onlyUnread) list = list.filter((n: any) => !n.isRead);
    // newest first
    return list.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.patch(notificationId, { isRead: true });
    return { success: true };
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q: any) => q.eq("userId", me._id))
      .filter((q: any) => q.eq(q.field("isRead"), false))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, { isRead: true });
    }

    return { success: true, count: notifications.length };
  },
});

// Create a notification for a user
export const createNotification = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("task_assigned"),
      v.literal("task_completed"),
      v.literal("task_updated"),
      v.literal("subtask_completed"),
      v.literal("deadline_approaching"),
      v.literal("group_invite"),
      v.literal("mention"),
      v.literal("task_delegated")
    ),
    title: v.string(),
    message: v.string(),
    relatedTaskId: v.optional(v.id("tasks")),
    relatedGroupId: v.optional(v.id("groups")),
    relatedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      encryptedTitle: args.title, // For MVP, storing plain text
      encryptedMessage: args.message,
      relatedTaskId: args.relatedTaskId,
      relatedGroupId: args.relatedGroupId,
      relatedUserId: args.relatedUserId,
      isRead: false,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

// Delete a notification
export const deleteNotification = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.delete(notificationId);
    return { success: true };
  },
});

// Get unread count
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q: any) =>
        q.eq("userId", me._id).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});
