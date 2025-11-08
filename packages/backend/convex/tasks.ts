import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

async function getMe(ctx: any) {
  const identity = await requireIdentity(ctx);
  const me = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!me) throw new Error("User not found");
  return me;
}

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    statusId: v.id("taskStatuses"),
    encryptedTitle: v.string(),
    encryptedDescription: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    deadline: v.optional(v.number()),
    // Initial assignments (max 3)
    assignments: v.array(
      v.object({
        userId: v.id("users"),
        taskRole: v.union(
          v.literal("owner"),
          v.literal("attendee"),
          v.literal("scrum_master")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const me = await getMe(ctx);
    if (args.assignments.length > 3) throw new Error("Max 3 assignments");
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      groupId: args.groupId,
      encryptedTitle: args.encryptedTitle,
      encryptedDescription: args.encryptedDescription,
      statusId: args.statusId,
      priority: args.priority,
      deadline: args.deadline,
      assignments: args.assignments,
      creatorId: me._id,
      isCompleted: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(taskId);
  },
});

export const listByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
      .collect();
  },
});

export const updateStatus = mutation({
  args: { taskId: v.id("tasks"), statusId: v.id("taskStatuses") },
  handler: async (ctx, { taskId, statusId }) => {
    await ctx.db.patch(taskId, { statusId, updatedAt: Date.now() });
    return { success: true };
  },
});

export const addAssignment = mutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
    taskRole: v.union(
      v.literal("owner"),
      v.literal("attendee"),
      v.literal("scrum_master")
    ),
  },
  handler: async (ctx, { taskId, userId, taskRole }) => {
    const t = await ctx.db.get(taskId);
    if (!t) throw new Error("Task not found");
    const exists = t.assignments.find((a: any) => a.userId === userId);
    if (exists) throw new Error("Already assigned");
    if (t.assignments.length >= 3) throw new Error("Max 3 assignments");
    await ctx.db.patch(taskId, {
      assignments: [...t.assignments, { userId, taskRole }],
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const grantAccess = mutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.id("users"),
    encryptedTaskKey: v.string(),
  },
  handler: async (ctx, { taskId, userId, encryptedTaskKey }) => {
    const me = await getMe(ctx);
    const now = Date.now();
    // Upsert in userTasks
    const existing = await ctx.db
      .query("userTasks")
      .withIndex("by_task_and_user", (q: any) =>
        q.eq("taskId", taskId).eq("userId", userId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedTaskKey,
        grantedAt: now,
        grantedBy: me._id,
      });
      return { success: true };
    }
    await ctx.db.insert("userTasks", {
      taskId,
      userId,
      encryptedTaskKey,
      grantedAt: now,
      grantedBy: me._id,
    });
    return { success: true };
  },
});
