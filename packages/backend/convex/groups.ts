import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";
import { canUserCreateGroups } from "./_lib/permissions";

async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return [];
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    const groups: any[] = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (g) groups.push(g);
    }
    return groups;
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user has permission to create groups
    const canCreate = await canUserCreateGroups(ctx, me._id);
    if (!canCreate) {
      throw new Error(
        "You don't have permission to create groups. Please contact an administrator."
      );
    }

    const now = Date.now();
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      creatorId: me._id,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: me._id,
      role: "owner",
      joinedAt: now,
    } as any);

    // Create default statuses: To Do, In Progress, Done
    const statuses = [
      { name: "To Do", color: "#64748b" },
      { name: "In Progress", color: "#f59e0b" },
      { name: "Done", color: "#10b981" },
    ];
    for (let i = 0; i < statuses.length; i++) {
      const s = statuses[i];
      await ctx.db.insert("taskStatuses", {
        groupId,
        name: s.name,
        order: i,
        color: s.color,
        isDefault: true,
        createdAt: now,
      });
    }

    // Audit log
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "create",
      entityType: "group",
      entityId: groupId,
      entityName: args.name,
      groupId: groupId,
      description: `Created group "${args.name}"`,
      metadata: {
        description: args.description,
        color: args.color,
      },
    });

    return await ctx.db.get(groupId);
  },
});

export const groupMembersList = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return members;
  },
});

export const myGroupsWithStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) return [];

    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    const groupsWithStats = [];
    for (const m of memberships) {
      const g = await ctx.db.get(m.groupId);
      if (!g) continue;

      // Get tasks for this group
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .collect();

      // Get the "Done" status to check which tasks are completed
      const statuses = await ctx.db
        .query("taskStatuses")
        .withIndex("by_group", (q) => q.eq("groupId", g._id))
        .collect();

      const doneStatus = statuses.find((s) => s.name === "Done");

      const totalTasks = tasks.length;
      const completedTasks = doneStatus
        ? tasks.filter((t) => t.statusId === doneStatus._id).length
        : tasks.filter((t) => t.isCompleted).length; // Fallback to isCompleted
      const pendingTasks = totalTasks - completedTasks;

      groupsWithStats.push({
        ...g,
        role: m.role,
        stats: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
        },
      });
    }

    return groupsWithStats;
  },
});

export const getGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    return await ctx.db.get(groupId);
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user is owner
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id)
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can edit group details");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.groupId, updates);

    const group = await ctx.db.get(args.groupId);
    if (group) {
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "update",
        entityType: "group",
        entityId: args.groupId,
        entityName: group.name,
        groupId: args.groupId,
        description: `Updated group details`,
        metadata: args,
      });
    }

    return { success: true };
  },
});

export const getMembersWithUserInfo = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const membersWithInfo = [];
    for (const member of members) {
      const user = await ctx.db.get(member.userId);
      if (user) {
        membersWithInfo.push({
          ...member,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            profilePicture: user.profilePicture,
          },
        });
      }
    }
    return membersWithInfo;
  },
});

export const getAvailableUsers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // Get all users
    const allUsers = await ctx.db.query("users").collect();

    // Get current group members
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    const memberIds = new Set(members.map((m) => m.userId));

    // Filter out users already in the group
    const availableUsers = allUsers
      .filter((user) => !memberIds.has(user._id))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        profilePicture: u.profilePicture,
      }));

    return availableUsers;
  },
});

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userEmail: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("scrum_master"),
      v.literal("attendee")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user has permission to add members
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id)
      )
      .first();

    if (!myMembership) {
      throw new Error("You are not a member of this group");
    }

    // Owner and scrum_master can add members
    if (myMembership.role !== "owner" && myMembership.role !== "scrum_master") {
      throw new Error("Only owners and scrum masters can add members");
    }

    // Find user by email
    const userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail.toLowerCase()))
      .first();

    if (!userToAdd) {
      throw new Error("User not found with that email");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", userToAdd._id)
      )
      .first();

    if (existing) {
      throw new Error("User is already a member of this group");
    }

    // Add member
    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: userToAdd._id,
      role: args.role,
      joinedAt: Date.now(),
    } as any);

    // Notify the new member
    const group = await ctx.db.get(args.groupId);
    if (group) {
      await ctx.db.insert("notifications", {
        userId: userToAdd._id,
        type: "group_invite",
        encryptedTitle: "Added to Group",
        encryptedMessage: me
          ? `${me.name} added you to "${group.name}"`
          : `You were added to "${group.name}"`,
        relatedGroupId: args.groupId,
        relatedUserId: me?._id,
        isRead: false,
        createdAt: Date.now(),
      });

      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "join",
        entityType: "group_member",
        entityId: userToAdd._id,
        entityName: userToAdd.name,
        groupId: args.groupId,
        description: `Added ${userToAdd.name} to group as ${args.role}`,
        metadata: {
          userEmail: args.userEmail,
          role: args.role,
        },
      });
    }

    return { success: true };
  },
});

export const addMemberById = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("scrum_master"),
      v.literal("attendee")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user has permission to add members
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id)
      )
      .first();

    if (!myMembership) {
      throw new Error("You are not a member of this group");
    }

    // Owner and scrum_master can add members
    if (myMembership.role !== "owner" && myMembership.role !== "scrum_master") {
      throw new Error("Only owners and scrum masters can add members");
    }

    // Check if user exists
    const userToAdd = await ctx.db.get(args.userId);
    if (!userToAdd) {
      throw new Error("User not found");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      throw new Error("User is already a member of this group");
    }

    // Add member
    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
    } as any);

    // Notify the new member
    const group = await ctx.db.get(args.groupId);
    if (group) {
      await ctx.db.insert("notifications", {
        userId: args.userId,
        type: "group_invite",
        encryptedTitle: "Added to Group",
        encryptedMessage: me
          ? `${me.name} added you to "${group.name}"`
          : `You were added to "${group.name}"`,
        relatedGroupId: args.groupId,
        relatedUserId: me._id,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    // Audit log
    const addedUser = await ctx.db.get(args.userId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "assign",
      entityType: "group_member",
      entityId: args.userId,
      entityName: addedUser?.name || "Unknown User",
      groupId: args.groupId,
      description: `Added ${addedUser?.name || "user"} to group as ${args.role}`,
      metadata: { userId: args.userId, role: args.role },
    });

    return { success: true };
  },
});

export const removeMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user has permission
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id)
      )
      .first();

    if (!myMembership) {
      throw new Error("You are not a member of this group");
    }

    // Owner and scrum_master can remove members
    if (myMembership.role !== "owner" && myMembership.role !== "scrum_master") {
      throw new Error("Only owners and scrum masters can remove members");
    }

    // Get the member to remove
    const memberToRemove = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (!memberToRemove) {
      throw new Error("Member not found in this group");
    }

    // Cannot remove owners (unless you're also an owner)
    if (memberToRemove.role === "owner" && myMembership.role !== "owner") {
      throw new Error("Only owners can remove other owners");
    }

    // Cannot remove yourself if you're the only owner
    if (me._id === args.userId && memberToRemove.role === "owner") {
      const allMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      const ownerCount = allMembers.filter((m) => m.role === "owner").length;
      if (ownerCount === 1) {
        throw new Error(
          "Cannot remove the only owner. Assign another owner first."
        );
      }
    }

    await ctx.db.delete(memberToRemove._id);

    // Audit log
    const removedUser = await ctx.db.get(args.userId);
    const group = await ctx.db.get(args.groupId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "delete",
      entityType: "group_member",
      entityId: args.userId,
      entityName: removedUser?.name || "Unknown User",
      groupId: args.groupId,
      description: `Removed ${removedUser?.name || "user"} from group`,
      metadata: {
        userId: args.userId,
        removedRole: memberToRemove.role,
        groupName: group?.name,
      },
    });

    return { success: true };
  },
});

export const updateMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    newRole: v.union(
      v.literal("owner"),
      v.literal("scrum_master"),
      v.literal("attendee")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!me) throw new Error("User not found");

    // Check if user has permission
    const myMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", me._id)
      )
      .first();

    if (!myMembership) {
      throw new Error("You are not a member of this group");
    }

    // Only owners can change roles
    if (myMembership.role !== "owner") {
      throw new Error("Only owners can change member roles");
    }

    // Get the member to update
    const memberToUpdate = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .first();

    if (!memberToUpdate) {
      throw new Error("Member not found in this group");
    }

    // If demoting yourself from owner, ensure there's at least one other owner
    if (
      me._id === args.userId &&
      memberToUpdate.role === "owner" &&
      args.newRole !== "owner"
    ) {
      const allMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();
      const ownerCount = allMembers.filter((m) => m.role === "owner").length;
      if (ownerCount === 1) {
        throw new Error(
          "Cannot demote the only owner. Promote another member first."
        );
      }
    }

    await ctx.db.patch(memberToUpdate._id, { role: args.newRole } as any);

    // Audit log
    const updatedUser = await ctx.db.get(args.userId);
    const group = await ctx.db.get(args.groupId);
    await createAuditLog(ctx, {
      userId: me._id,
      userName: me.name,
      action: "update",
      entityType: "group_member",
      entityId: args.userId,
      entityName: updatedUser?.name || "Unknown User",
      groupId: args.groupId,
      description: `Changed ${updatedUser?.name || "user"}'s role from ${memberToUpdate.role} to ${args.newRole}`,
      metadata: {
        userId: args.userId,
        oldRole: memberToUpdate.role,
        newRole: args.newRole,
        groupName: group?.name,
      },
    });

    return { success: true };
  },
});
