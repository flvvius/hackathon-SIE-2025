import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";

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

    // Audit log
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "create",
      entityType: "task",
      entityId: taskId,
      entityName: args.encryptedTitle,
      groupId: args.groupId,
      description: `Created task "${args.encryptedTitle}"`,
      metadata: {
        priority: args.priority,
        assignmentsCount: args.assignments.length,
        deadline: args.deadline,
      },
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
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Check if moving to "Done" status
    const newStatus = await ctx.db.get(statusId);
    const wasNotDone = task.statusId !== statusId; // Track if status is actually changing

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

    // If task was just marked as Done, notify relevant members
    if (newStatus && newStatus.name === "Done" && wasNotDone) {
      const identity = await ctx.auth.getUserIdentity();
      const me = identity
        ? await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q: any) =>
              q.eq("clerkId", identity.subject)
            )
            .first()
        : null;

      // Get all group members with owner or scrum_master role
      const groupMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q: any) => q.eq("groupId", task.groupId))
        .collect();

      const relevantMembers = groupMembers.filter(
        (member: any) =>
          (member.role === "owner" || member.role === "scrum_master") &&
          member.userId !== me?._id // Don't notify the person who completed it
      );

      // Create notifications for relevant members
      for (const member of relevantMembers) {
        await ctx.db.insert("notifications", {
          userId: member.userId,
          type: "task_completed",
          encryptedTitle: "Task Completed",
          encryptedMessage: me
            ? `${me.name} marked a task as done`
            : "A task was marked as done",
          relatedTaskId: taskId,
          relatedGroupId: task.groupId,
          relatedUserId: me?._id,
          isRead: false,
          createdAt: Date.now(),
        });
      }
    }

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
      const oldStatus = await ctx.db.get(task.statusId);
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "update",
        entityType: "task",
        entityId: taskId,
        entityName: task.encryptedTitle,
        groupId: task.groupId,
        description: `Updated task status from "${oldStatus?.name || "Unknown"}" to "${newStatus?.name || "Unknown"}"`,
        metadata: {
          oldStatusId: task.statusId,
          newStatusId: statusId,
          oldStatusName: oldStatus?.name,
          newStatusName: newStatus?.name,
        },
      });
    }

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

    // Audit log
    const me = await getMe(ctx);
    const assignedUser = await ctx.db.get(userId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "assign",
      entityType: "task",
      entityId: taskId,
      entityName: t.encryptedTitle,
      groupId: t.groupId,
      description: `Assigned ${assignedUser?.name || "user"} to task as ${taskRole}`,
      metadata: {
        assignedUserId: userId,
        assignedUserName: assignedUser?.name,
        taskRole,
      },
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

      // Audit log
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "delete",
        entityType: "task",
        entityId: taskId,
        entityName: t.encryptedTitle,
        groupId: t.groupId,
        description: `Removed self from task`,
        metadata: { action: "unassign" },
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

      // Audit log
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "assign",
        entityType: "task",
        entityId: taskId,
        entityName: t.encryptedTitle,
        groupId: t.groupId,
        description: `Assigned self to task as attendee`,
        metadata: { action: "self_assign" },
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

    // Audit log
    const me = await getMe(ctx);
    const removedUser = await ctx.db.get(userId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "delete",
      entityType: "task",
      entityId: taskId,
      entityName: t.encryptedTitle,
      groupId: t.groupId,
      description: `Removed ${removedUser?.name || "user"} from task`,
      metadata: {
        removedUserId: userId,
        removedUserName: removedUser?.name,
      },
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

      // Audit log
      const task = await ctx.db.get(taskId);
      const grantedUser = await ctx.db.get(userId);
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "update",
        entityType: "task",
        entityId: taskId,
        entityName: task?.encryptedTitle || "Unknown Task",
        groupId: task?.groupId,
        description: `Updated access key for ${grantedUser?.name || "user"}`,
        metadata: {
          grantedUserId: userId,
          grantedUserName: grantedUser?.name,
        },
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

    // Audit log
    const task = await ctx.db.get(taskId);
    const grantedUser = await ctx.db.get(userId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "assign",
      entityType: "task",
      entityId: taskId,
      entityName: task?.encryptedTitle || "Unknown Task",
      groupId: task?.groupId,
      description: `Granted access to ${grantedUser?.name || "user"}`,
      metadata: {
        grantedUserId: userId,
        grantedUserName: grantedUser?.name,
      },
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
      assignments: [], // Start with no assignments - use delegation flow instead
      creatorId: me._id,
      isCompleted: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "create",
      entityType: "task",
      entityId: taskId,
      entityName: args.title,
      groupId: args.groupId,
      description: `Created task "${args.title}"`,
      metadata: {
        priority: args.priority,
        deadline: args.deadline,
      },
    });

    return await ctx.db.get(taskId);
  },
});

// Delegate/assign a task to another user (creating assignment chain)
export const delegateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    assignToUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await getMe(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Get current user's role in the group
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q: any) =>
        q.eq("groupId", task.groupId).eq("userId", me._id)
      )
      .first();

    if (!myMembership) throw new Error("You are not a member of this group");

    // Get the assignee's role in the group
    const assigneeMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q: any) =>
        q.eq("groupId", task.groupId).eq("userId", args.assignToUserId)
      )
      .first();

    if (!assigneeMembership)
      throw new Error("Assignee is not a member of this group");

    // Validation rules:
    // - Owner can delegate to scrum_master or attendee
    // - Scrum master can delegate to attendee ONLY if task is currently assigned to them
    // - Attendee cannot delegate
    const myRole = myMembership.role;
    const assigneeRole = assigneeMembership.role;

    if (myRole === "attendee") {
      throw new Error("Attendees cannot delegate tasks");
    }

    // Scrum masters can only delegate if the task is currently assigned to them
    if (myRole === "scrum_master") {
      if (task.currentAssignee !== me._id) {
        throw new Error(
          "Scrum masters can only delegate tasks that are currently assigned to them"
        );
      }
      if (assigneeRole !== "attendee") {
        throw new Error("Scrum masters can only delegate to attendees");
      }
    }

    // Owners can always delegate (unless other limits are reached)
    if (myRole === "owner" && assigneeRole === "owner") {
      throw new Error("Cannot delegate to another owner");
    }

    // Check if task is already delegated to this user
    if (task.currentAssignee === args.assignToUserId) {
      throw new Error("Task is already assigned to this user");
    }

    // Check if this user already received this task in the chain
    const alreadyInChain = task.assignmentChain?.some(
      (entry: any) => entry.assignedTo === args.assignToUserId
    );
    if (alreadyInChain) {
      throw new Error("This user has already been assigned this task before");
    }

    // Limit assignment chain to max 3 delegations
    // (Creator + 3 delegations = max 4 people in the flow)
    if (task.assignmentChain && task.assignmentChain.length >= 3) {
      throw new Error("Maximum delegation limit reached (3 delegations max)");
    }

    // Create new assignment chain entry
    const newChainEntry = {
      assignedBy: me._id,
      assignedTo: args.assignToUserId,
      assignerRole: myRole,
      assigneeRole: assigneeRole,
      timestamp: Date.now(),
    };

    // Update task with new assignment chain and current assignee
    await ctx.db.patch(args.taskId, {
      assignmentChain: [...(task.assignmentChain || []), newChainEntry],
      currentAssignee: args.assignToUserId,
      updatedAt: Date.now(),
    });

    // Create notification for the assignee
    const assignee = await ctx.db.get(args.assignToUserId);
    if (assignee) {
      await ctx.db.insert("notifications", {
        userId: args.assignToUserId,
        type: "task_delegated",
        encryptedTitle: "New Task Assigned",
        encryptedMessage: `${me.name} delegated a task to you`,
        relatedTaskId: args.taskId,
        relatedGroupId: task.groupId,
        relatedUserId: me._id,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    // Audit log
    const assigneeUser = await ctx.db.get(args.assignToUserId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "assign",
      entityType: "task",
      entityId: args.taskId,
      entityName: task.encryptedTitle,
      groupId: task.groupId,
      description: `Delegated task to ${assigneeUser?.name || "user"}`,
      metadata: {
        assignedToUserId: args.assignToUserId,
        assignedToUserName: assigneeUser?.name,
        delegatorRole: myRole,
        assigneeRole: assigneeRole,
      },
    });

    return await ctx.db.get(args.taskId);
  },
});

// Get task with full assignment chain and user details
export const getTaskWithFlow = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return null;

    // Get creator info
    const creator = await ctx.db.get(task.creatorId);

    // Get current assignee info
    let currentAssignee = null;
    if (task.currentAssignee) {
      currentAssignee = await ctx.db.get(task.currentAssignee);
    }

    // Get assignment chain with user details
    let assignmentChainWithUsers = null;
    if (task.assignmentChain && task.assignmentChain.length > 0) {
      assignmentChainWithUsers = await Promise.all(
        task.assignmentChain.map(async (entry: any) => {
          const assignedBy = await ctx.db.get(entry.assignedBy);
          const assignedTo = await ctx.db.get(entry.assignedTo);
          return {
            ...entry,
            assignedByUser: assignedBy
              ? {
                  _id: assignedBy._id,
                  name: (assignedBy as any).name,
                  email: (assignedBy as any).email,
                  profilePicture: (assignedBy as any).profilePicture,
                }
              : null,
            assignedToUser: assignedTo
              ? {
                  _id: assignedTo._id,
                  name: (assignedTo as any).name,
                  email: (assignedTo as any).email,
                  profilePicture: (assignedTo as any).profilePicture,
                }
              : null,
          };
        })
      );
    }

    return {
      ...task,
      creator: creator
        ? {
            _id: creator._id,
            name: (creator as any).name,
            email: (creator as any).email,
            profilePicture: (creator as any).profilePicture,
          }
        : null,
      currentAssigneeUser: currentAssignee
        ? {
            _id: currentAssignee._id,
            name: (currentAssignee as any).name,
            email: (currentAssignee as any).email,
            profilePicture: (currentAssignee as any).profilePicture,
          }
        : null,
      assignmentChainWithUsers,
    };
  },
});
