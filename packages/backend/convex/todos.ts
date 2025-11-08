import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { createAuditLog } from "./_lib/auditLog";

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("todos").collect();
  },
});

export const create = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    const newTodoId = await ctx.db.insert("todos", {
      text: args.text,
      completed: false,
    });

    // Audit log
    if (me) {
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "create",
        entityType: "todo",
        entityId: newTodoId,
        entityName: args.text,
        groupId: undefined,
        description: `Created todo: ${args.text}`,
        metadata: { text: args.text },
      });
    }

    return await ctx.db.get(newTodoId);
  },
});

export const toggle = mutation({
  args: {
    id: v.id("todos"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    const todo = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { completed: args.completed });

    // Audit log
    if (me && todo) {
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: args.completed ? "complete" : "update",
        entityType: "todo",
        entityId: args.id,
        entityName: todo.text,
        groupId: undefined,
        description: args.completed
          ? `Marked todo as complete: ${todo.text}`
          : `Marked todo as incomplete: ${todo.text}`,
        metadata: { completed: args.completed },
      });
    }

    return { success: true };
  },
});

export const deleteTodo = mutation({
  args: {
    id: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const me = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) =>
            q.eq("clerkId", identity.subject)
          )
          .first()
      : null;

    const todo = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);

    // Audit log
    if (me && todo) {
      await createAuditLog(ctx, {
        userId: me._id,
        userName: me.name,
        action: "delete",
        entityType: "todo",
        entityId: args.id,
        entityName: todo.text,
        groupId: undefined,
        description: `Deleted todo: ${todo.text}`,
        metadata: { text: todo.text },
      });
    }

    return { success: true };
  },
});
