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
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
      .collect();

    // Add subtask counts to each task
    const tasksWithSubtasks = await Promise.all(
      tasks.map(async (task) => {
        const subtasks = await ctx.db
          .query("subtasks")
          .withIndex("by_parent_task", (q: any) =>
            q.eq("parentTaskId", task._id)
          )
          .collect();

        return {
          ...task,
          subtaskCount: subtasks.length,
          completedSubtaskCount: subtasks.filter((s: any) => s.isCompleted)
            .length,
        };
      })
    );

    return tasksWithSubtasks;
  },
});

export const updateStatus = mutation({
  args: { taskId: v.id("tasks"), statusId: v.id("taskStatuses") },
  handler: async (ctx, { taskId, statusId }) => {
    // Check if moving to "Done" status
    const newStatus = await ctx.db.get(statusId);
    if (newStatus && newStatus.name === "Done") {
      // Check if all subtasks are completed
      const subtasks = await ctx.db
        .query("subtasks")
        .withIndex("by_parent_task", (q: any) => q.eq("parentTaskId", taskId))
        .collect();

      if (subtasks.length > 0) {
        const incompleteSubtasks = subtasks.filter((s: any) => !s.isCompleted);
        if (incompleteSubtasks.length > 0) {
          throw new Error(
            `Cannot mark task as done. ${incompleteSubtasks.length} subtask${
              incompleteSubtasks.length > 1 ? "s" : ""
            } still incomplete.`
          );
        }
      }
    }

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

export const getStatuses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    return await ctx.db
      .query("taskStatuses")
      .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
      .order("asc")
      .collect();
  },
});

export const createSimple = mutation({
  args: {
    groupId: v.id("groups"),
    statusId: v.id("taskStatuses"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getMe(ctx);
    const now = Date.now();

    // For MVP, store plain text in encrypted fields
    const taskId = await ctx.db.insert("tasks", {
      groupId: args.groupId,
      encryptedTitle: args.title,
      encryptedDescription: args.description,
      statusId: args.statusId,
      priority: args.priority,
      deadline: args.deadline,
      assignments: [{ userId: me._id, taskRole: "owner" }],
      creatorId: me._id,
      isCompleted: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(taskId);
  },
});
