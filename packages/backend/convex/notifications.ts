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
    let q = ctx.db.query("notifications").withIndex("by_user", (qi: any) => qi.eq("userId", me._id));
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
