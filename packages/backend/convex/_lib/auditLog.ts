import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    userId: Id<"users">;
    userName: string;
    action: string;
    entityType:
      | "task"
      | "subtask"
      | "group"
      | "user"
      | "group_member"
      | "notification"
      | "comment"
      | "todo";
    entityId: string;
    entityName?: string;
    groupId?: Id<"groups">;
    description: string;
    metadata?: Record<string, any>;
  }
) {
  await ctx.db.insert("auditLogs", {
    userId: params.userId,
    userName: params.userName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    groupId: params.groupId,
    description: params.description,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    timestamp: Date.now(),
  });
}
