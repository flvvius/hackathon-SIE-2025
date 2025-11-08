import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";

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
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    await ctx.db.patch(notificationId, { isRead: true });

    // Audit log (optional - notifications are low priority)
    if (me) {
      const notification = await ctx.db.get(notificationId);
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "update",
        entityType: "notification",
        entityId: notificationId,
        entityName: notification?.encryptedTitle || "Notification",
        groupId: notification?.relatedGroupId,
        description: `Marked notification as read`,
        metadata: { notificationType: notification?.type },
      });
    }

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

    // Audit log
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "update",
      entityType: "notification",
      entityId: me._id, // Using user ID since it's a bulk operation
      entityName: "All Notifications",
      groupId: undefined,
      description: `Marked all notifications as read (${notifications.length} notifications)`,
      metadata: { count: notifications.length },
    });

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

    // Audit log
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    if (me) {
      const recipient = await ctx.db.get(args.userId);
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "create",
        entityType: "notification",
        entityId: notificationId,
        entityName: args.title,
        groupId: args.relatedGroupId,
        description: `Created notification for ${recipient?.name || "user"}: ${args.title}`,
        metadata: {
          type: args.type,
          recipientId: args.userId,
          recipientName: recipient?.name,
        },
      });
    }

    return notificationId;
  },
});

// Delete a notification
export const deleteNotification = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    const notification = await ctx.db.get(notificationId);
    await ctx.db.delete(notificationId);

    // Audit log
    if (me && notification) {
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "delete",
        entityType: "notification",
        entityId: notificationId,
        entityName: notification.encryptedTitle || "Notification",
        groupId: notification.relatedGroupId,
        description: `Deleted notification: ${notification.encryptedTitle}`,
        metadata: { type: notification.type },
      });
    }

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
