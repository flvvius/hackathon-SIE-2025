import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    encryptedTitle: v.string(),
    encryptedDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // order = count existing
    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) => q.eq("parentTaskId", args.parentTaskId))
      .collect();
    const id = await ctx.db.insert("subtasks", {
      parentTaskId: args.parentTaskId,
      encryptedTitle: args.encryptedTitle,
      encryptedDescription: args.encryptedDescription,
      order: existing.length,
      isCompleted: false,
      completedAt: undefined,
      completedBy: undefined,
      assignedTo: undefined,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: { parentTaskId: v.id("tasks") },
  handler: async (ctx, { parentTaskId }) => {
    return await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) => q.eq("parentTaskId", parentTaskId))
      .collect();
  },
});

export const toggleComplete = mutation({
  args: { subtaskId: v.id("subtasks"), completed: v.boolean(), userId: v.id("users") },
  handler: async (ctx, { subtaskId, completed, userId }) => {
    const st = await ctx.db.get(subtaskId);
    if (!st) throw new Error("Subtask not found");
    await ctx.db.patch(subtaskId, {
      isCompleted: completed,
      completedAt: completed ? Date.now() : undefined,
      completedBy: completed ? userId : undefined,
      updatedAt: Date.now(),
    });
    // Auto-complete parent task if all subtasks completed
    const siblings = await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) => q.eq("parentTaskId", st.parentTaskId))
      .collect();
    if (siblings.length > 0 && siblings.every((s: any) => s.isCompleted)) {
      await ctx.db.patch(st.parentTaskId, {
        isCompleted: true,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else if (completed === false) {
      // Re-open task if a subtask was unchecked
      await ctx.db.patch(st.parentTaskId, {
        isCompleted: false,
        completedAt: undefined,
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});
