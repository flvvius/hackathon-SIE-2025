import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";

export const add = mutation({
  args: {
    taskId: v.id("tasks"),
    encryptedContent: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");
    const now = Date.now();
    const id = await ctx.db.insert("comments", {
      taskId: args.taskId,
      userId: me._id,
      encryptedContent: args.encryptedContent,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
    });

    // Audit log
    const task = await ctx.db.get(args.taskId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "create",
      entityType: "comment",
      entityId: id,
      entityName: `Comment on task`,
      groupId: task?.groupId,
      description: `Added comment to task "${task?.encryptedTitle || "Unknown"}"`,
      metadata: {
        taskId: args.taskId,
        taskTitle: task?.encryptedTitle,
      },
    });

    return await ctx.db.get(id);
  },
});

export const list = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_task", (q: any) => q.eq("taskId", taskId))
      .collect();
    return comments.sort((a: any, b: any) => a.createdAt - b.createdAt);
  },
});
