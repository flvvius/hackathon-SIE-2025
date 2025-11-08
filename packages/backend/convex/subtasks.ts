import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";
import { getUserRoleInGroup } from "./_lib/permissions";

export const create = mutation({
  args: {
    parentTaskId: v.id("tasks"),
    encryptedTitle: v.string(),
    encryptedDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get the parent task
    const task = await ctx.db.get(args.parentTaskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check permissions based on role in the group
    const userRole = await getUserRoleInGroup(
      ctx,
      currentUser._id,
      task.groupId
    );
    if (!userRole) {
      throw new Error("You are not a member of this group");
    }

    // Permission rules:
    // - Owners can always create subtasks
    // - Scrum masters can create subtasks ONLY if they are currently assigned OR were assigned in the past
    // - Attendees cannot create subtasks
    if (userRole === "scrum_master") {
      const isCurrentlyAssigned = task.currentAssignee === currentUser._id;
      const wasAssignedInPast = task.assignmentChain?.some(
        (assignment) => assignment.assignedTo === currentUser._id
      );

      if (!isCurrentlyAssigned && !wasAssignedInPast) {
        throw new Error(
          "Scrum Masters can only create subtasks for tasks that are or were delegated to them"
        );
      }
    } else if (userRole === "attendee") {
      // Attendees cannot create subtasks
      throw new Error("Attendees cannot create subtasks");
    }
    // Owners can always create subtasks (no additional check needed)

    const now = Date.now();
    // order = count existing
    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) =>
        q.eq("parentTaskId", args.parentTaskId)
      )
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

    // Audit log
    await createAuditLog(ctx, {
      userId: currentUser._id,
      userName: currentUser.name,
      action: "create",
      entityType: "subtask",
      entityId: id,
      entityName: args.encryptedTitle.substring(0, 50), // First 50 chars
      groupId: task.groupId,
      description: `Created subtask for task`,
      metadata: {
        parentTaskId: args.parentTaskId,
      },
    });

    return await ctx.db.get(id);
  },
});

export const list = query({
  args: { parentTaskId: v.id("tasks") },
  handler: async (ctx, { parentTaskId }) => {
    return await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) =>
        q.eq("parentTaskId", parentTaskId)
      )
      .collect();
  },
});

export const toggleComplete = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    completed: v.boolean(),
    userId: v.id("users"),
  },
  handler: async (ctx, { subtaskId, completed, userId }) => {
    const st = await ctx.db.get(subtaskId);
    if (!st) throw new Error("Subtask not found");

    const wasNotCompleted = !st.isCompleted; // Track if this is a new completion

    // Get parent task once at the beginning
    const task = await ctx.db.get(st.parentTaskId);
    if (!task) throw new Error("Parent task not found");

    await ctx.db.patch(subtaskId, {
      isCompleted: completed,
      completedAt: completed ? Date.now() : undefined,
      completedBy: completed ? userId : undefined,
      updatedAt: Date.now(),
    });

    // If subtask was just completed, notify scrum masters
    if (completed && wasNotCompleted) {
      const user = await ctx.db.get(userId);

      // Get all scrum masters in the group
      const groupMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q: any) => q.eq("groupId", task.groupId))
        .collect();

      const scrumMasters = groupMembers.filter(
        (member: any) =>
          member.role === "scrum_master" && member.userId !== userId // Don't notify the person who completed it
      );

      // Create notifications for scrum masters
      for (const sm of scrumMasters) {
        await ctx.db.insert("notifications", {
          userId: sm.userId,
          type: "subtask_completed",
          encryptedTitle: "Subtask Completed",
          encryptedMessage: user
            ? `${user.name} completed a subtask`
            : "A subtask was completed",
          relatedTaskId: st.parentTaskId,
          relatedGroupId: task.groupId,
          relatedUserId: userId,
          isRead: false,
          createdAt: Date.now(),
        });
      }
    }

    // Auto-move parent task to "Done" if all subtasks completed
    const siblings = await ctx.db
      .query("subtasks")
      .withIndex("by_parent_task", (q: any) =>
        q.eq("parentTaskId", st.parentTaskId)
      )
      .collect();

    if (siblings.length > 0 && siblings.every((s: any) => s.isCompleted)) {
      // Find the "Done" status for this group
      const doneStatus = await ctx.db
        .query("taskStatuses")
        .withIndex("by_group", (q: any) => q.eq("groupId", task.groupId))
        .filter((q: any) => q.eq(q.field("name"), "Done"))
        .first();

      if (doneStatus) {
        // Move task to "Done" status
        await ctx.db.patch(st.parentTaskId, {
          statusId: doneStatus._id,
          isCompleted: true,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Audit log for auto-completion
        const user = await ctx.db.get(userId);
        if (user) {
          await createAuditLog(ctx, {
            userId: userId,
            userName: user.name,
            action: "update",
            entityType: "task",
            entityId: st.parentTaskId,
            entityName: task.encryptedTitle,
            groupId: task.groupId,
            description: `Task automatically moved to Done (all subtasks completed)`,
            metadata: {
              statusId: doneStatus._id,
              statusName: "Done",
              trigger: "all_subtasks_completed",
            },
          });
        }
      }
    } else if (completed === false) {
      // Don't auto-reopen the task - let users manually manage task status
      // This prevents confusion when someone unchecks a subtask
      // The task will stay in "Done" if it was manually moved there
    }

    // Audit log
    const user = await ctx.db.get(userId);
    if (user && task) {
      await createAuditLog(ctx, {
        userId: userId,
        userName: user.name,
        action: completed ? "complete" : "update",
        entityType: "subtask",
        entityId: subtaskId,
        entityName: st.encryptedTitle.substring(0, 50),
        groupId: task.groupId,
        description: completed
          ? `Marked subtask as complete`
          : `Reopened subtask`,
        metadata: {
          parentTaskId: st.parentTaskId,
          completed,
        },
      });
    }

    return { success: true };
  },
});

// Delegate/assign a subtask to a user
export const delegateSubtask = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    assignToUserId: v.id("users"),
  },
  handler: async (ctx, { subtaskId, assignToUserId }) => {
    // Get auth identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!currentUser) throw new Error("User not found");

    // Get subtask
    const subtask = await ctx.db.get(subtaskId);
    if (!subtask) throw new Error("Subtask not found");

    // Get parent task to access groupId
    const task = await ctx.db.get(subtask.parentTaskId);
    if (!task) throw new Error("Parent task not found");

    // Check if current user has scrum_master role in the group
    const currentUserRole = await getUserRoleInGroup(
      ctx,
      currentUser._id,
      task.groupId
    );
    if (currentUserRole !== "scrum_master") {
      throw new Error("Only Scrum Masters can delegate subtasks");
    }

    // Check if trying to assign to the same user
    if (subtask.assignedTo === assignToUserId) {
      throw new Error("This subtask is already assigned to this user");
    }

    // Get the user being assigned to
    const assignToUser = await ctx.db.get(assignToUserId);
    if (!assignToUser) throw new Error("User to assign not found");

    // Check if assignToUser has "attendee" role in the group
    const assignToUserRole = await getUserRoleInGroup(
      ctx,
      assignToUserId,
      task.groupId
    );
    if (assignToUserRole !== "attendee") {
      throw new Error(
        "Subtasks can only be assigned to users with Attendee role in this group"
      );
    } // Update subtask with assignedTo
    await ctx.db.patch(subtaskId, {
      assignedTo: assignToUserId,
      updatedAt: Date.now(),
    });

    // Get the assigned user for notification
    const assignedUser = await ctx.db.get(assignToUserId);

    // Create notification for the assigned user
    await ctx.db.insert("notifications", {
      userId: assignToUserId,
      type: "subtask_delegated",
      encryptedTitle: "Subtask Assigned",
      encryptedMessage: `${currentUser.name} assigned you a subtask: ${subtask.encryptedTitle}`,
      relatedTaskId: subtask.parentTaskId,
      relatedSubtaskId: subtaskId,
      relatedGroupId: task.groupId,
      relatedUserId: currentUser._id,
      isRead: false,
      createdAt: Date.now(),
    });

    // Audit log
    await createAuditLog(ctx, {
      userId: currentUser._id,
      userName: currentUser.name,
      action: "assign",
      entityType: "subtask",
      entityId: subtaskId,
      entityName: subtask.encryptedTitle.substring(0, 50),
      groupId: task.groupId,
      description: `Assigned subtask to ${assignToUser.name}`,
      metadata: {
        assignedTo: assignToUserId,
        assignedToName: assignToUser.name,
        parentTaskId: subtask.parentTaskId,
      },
    });

    return { success: true };
  },
});
