import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users - profiluri utilizatori
  users: defineTable({
    clerkId: v.string(), // ID-ul din Clerk pentru autentificare
    email: v.string(),
    name: v.string(),
    profilePicture: v.optional(v.string()),
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    // Rol implicit selectat la primul login (pentru UX); rolurile reale în grup rămân în groupMembers
    defaultRole: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("scrum_master"),
        v.literal("attendee")
      )
    ),
    publicKey: v.optional(v.string()), // Cheie publică pentru encriptare end-to-end (optional for MVP)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Groups - grupuri de task-uri
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    creatorId: v.id("users"),
    color: v.optional(v.string()), // Pentru identificare vizuală
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_created_at", ["createdAt"]),

  // Group Members - membri ai grupurilor
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"), // Group owner - full control
      v.literal("scrum_master"), // Can manage tasks and members
      v.literal("attendee") // Can view and create subtasks
    ),
    joinedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  // Task Statuses - statusuri predefinite și custom
  taskStatuses: defineTable({
    groupId: v.id("groups"),
    name: v.string(), // "To Do", "In Progress", "Done" sau custom
    order: v.number(), // Pentru ordonare
    color: v.string(), // Culoare hex pentru UI
    isDefault: v.boolean(), // true pentru statusurile predefinite
    createdAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_and_order", ["groupId", "order"]),

  // Tasks - task-uri principale (encriptate)
  tasks: defineTable({
    groupId: v.id("groups"),
    // Date encriptate end-to-end - fiecare membru primește o copie encriptată cu cheia sa publică
    encryptedTitle: v.string(), // Titlu encriptat
    encryptedDescription: v.optional(v.string()), // Descriere encriptată

    statusId: v.id("taskStatuses"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    deadline: v.optional(v.number()), // Timestamp optional

    // Assignments - max 3 persoane cu roluri
    // Array de assignments: [{userId, taskRole}]
    assignments: v.array(
      v.object({
        userId: v.id("users"),
        taskRole: v.union(
          v.literal("owner"), // Task owner - administrator complet
          v.literal("attendee"), // Utilizator basic care își face task-ul
          v.literal("scrum_master") // Maintainer-ul task-ului
        ),
      })
    ),

    // Metadata neencriptată pentru indexare
    creatorId: v.id("users"),
    isCompleted: v.boolean(), // Auto-completat când toate subtask-urile sunt complete
    completedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_status", ["statusId"])
    .index("by_creator", ["creatorId"])
    .index("by_group_and_status", ["groupId", "statusId"])
    .index("by_group_and_completed", ["groupId", "isCompleted"])
    .index("by_deadline", ["deadline"])
    .index("by_created_at", ["createdAt"]),

  // User Tasks - tabel de joncțiune între users și tasks + chei de encriptare
  // Arată ce task-uri vede fiecare user și cum le poate decripta
  userTasks: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    // Cheia simetrică a task-ului encriptată cu cheia publică a utilizatorului
    encryptedTaskKey: v.string(),
    grantedAt: v.number(),
    grantedBy: v.id("users"),
  })
    .index("by_task", ["taskId"])
    .index("by_user", ["userId"])
    .index("by_task_and_user", ["taskId", "userId"]),

  // Subtasks - subtask-uri (nu pot genera alte subtask-uri)
  subtasks: defineTable({
    parentTaskId: v.id("tasks"),

    // Date encriptate
    encryptedTitle: v.string(),
    encryptedDescription: v.optional(v.string()),

    order: v.number(), // Pentru ordonare în listă
    isCompleted: v.boolean(),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),

    assignedTo: v.optional(v.id("users")), // Assignee specific pentru subtask

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_parent_task", ["parentTaskId"])
    .index("by_parent_and_completed", ["parentTaskId", "isCompleted"])
    .index("by_assigned_to", ["assignedTo"]),

  // Notifications - notificări pentru utilizatori
  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("task_assigned"),
      v.literal("task_completed"),
      v.literal("task_updated"),
      v.literal("subtask_completed"),
      v.literal("deadline_approaching"),
      v.literal("group_invite"),
      v.literal("mention")
    ),
    relatedTaskId: v.optional(v.id("tasks")),
    relatedGroupId: v.optional(v.id("groups")),
    relatedUserId: v.optional(v.id("users")), // Cine a generat notificarea

    encryptedTitle: v.string(), // Titlu notificare encriptat
    encryptedMessage: v.string(), // Mesaj encriptat

    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "isRead"])
    .index("by_created_at", ["createdAt"]),

  // Activity Logs - logging pentru debugging și audit
  activityLogs: defineTable({
    userId: v.id("users"),
    action: v.string(), // "create_task", "update_task", "complete_task", etc.
    entityType: v.union(
      v.literal("task"),
      v.literal("subtask"),
      v.literal("group"),
      v.literal("user")
    ),
    entityId: v.string(), // ID-ul entității afectate
    metadata: v.optional(v.string()), // JSON string cu detalii suplimentare
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_timestamp", ["timestamp"]),

  // Comments - comentarii pe task-uri (encriptate)
  comments: defineTable({
    taskId: v.id("tasks"),
    userId: v.id("users"),
    encryptedContent: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    isEdited: v.boolean(),
  })
    .index("by_task", ["taskId"])
    .index("by_user", ["userId"])
    .index("by_task_and_created", ["taskId", "createdAt"]),

  // Group Keys - chei de grup encriptate pentru fiecare membru
  groupKeys: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    encryptedGroupKey: v.string(), // Group symmetric key encrypted with user's public key
    grantedAt: v.number(),
    grantedBy: v.id("users"),
  })
    .index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_and_user", ["groupId", "userId"]),

  // Deprecated - păstrat pentru compatibilitate
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
});