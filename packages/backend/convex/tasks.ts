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

    // Add subtask counts and user info for assignments to each task
    const tasksWithSubtasks = await Promise.all(
      tasks.map(async (task) => {
        const subtasks = await ctx.db
          .query("subtasks")
          .withIndex("by_parent_task", (q: any) =>
            q.eq("parentTaskId", task._id)
          )
          .collect();

        // Fetch user info for each assignment
        const assignmentsWithUserInfo = await Promise.all(
          task.assignments.map(async (assignment: any) => {
            const user = await ctx.db.get(assignment.userId);
            return {
              ...assignment,
              user: user
                ? {
                    _id: user._id,
                    name: (user as any).name,
                    email: (user as any).email,
                    profilePicture: (user as any).profilePicture,
                  }
                : null,
            };
          })
        );

        return {
          ...task,
          assignments: assignmentsWithUserInfo,
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

export const toggleSelfAssignment = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const me = await getMe(ctx);
    const t = await ctx.db.get(taskId);
    if (!t) throw new Error("Task not found");

    const existingIndex = t.assignments.findIndex(
      (a: any) => a.userId === me._id
    );

    if (existingIndex >= 0) {
      // Remove self from assignments
      const newAssignments = t.assignments.filter(
        (a: any) => a.userId !== me._id
      );
      await ctx.db.patch(taskId, {
        assignments: newAssignments,
        updatedAt: Date.now(),
      });
      return { success: true, assigned: false };
    } else {
      // Add self to assignments
      if (t.assignments.length >= 3)
        throw new Error("Max 3 assignments reached");
      await ctx.db.patch(taskId, {
        assignments: [
          ...t.assignments,
          { userId: me._id, taskRole: "attendee" },
        ],
        updatedAt: Date.now(),
      });
      return { success: true, assigned: true };
    }
  },
});

export const removeAssignment = mutation({
  args: { taskId: v.id("tasks"), userId: v.id("users") },
  handler: async (ctx, { taskId, userId }) => {
    const t = await ctx.db.get(taskId);
    if (!t) throw new Error("Task not found");
    const newAssignments = t.assignments.filter(
      (a: any) => a.userId !== userId
    );
    await ctx.db.patch(taskId, {
      assignments: newAssignments,
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
    assigneeIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const me = await getMe(ctx);
    const now = Date.now();

    // Build assignments array - only include assignees if provided
    const assignments: any[] = [];

    // Add assignees if provided (max 3 total)
    if (args.assigneeIds && args.assigneeIds.length > 0) {
      const assigneesToAdd = args.assigneeIds.slice(0, 3);

      for (const userId of assigneesToAdd) {
        // First assignee is owner, rest are attendees
        const taskRole = assignments.length === 0 ? "owner" : "attendee";
        assignments.push({ userId, taskRole });
      }
    }

    // For MVP, store plain text in encrypted fields
    const taskId = await ctx.db.insert("tasks", {
      groupId: args.groupId,
      encryptedTitle: args.title,
      encryptedDescription: args.description,
      statusId: args.statusId,
      priority: args.priority,
      deadline: args.deadline,
      assignments,
      creatorId: me._id,
      isCompleted: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(taskId);
  },
});
