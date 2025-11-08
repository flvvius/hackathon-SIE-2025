import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper: get auth identity or throw
async function requireIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

// Upsert the currently authenticated Clerk user into `users` table.
export const upsertCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const { subject: clerkId, email, name, picture } = identity;
    // Try existing
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: email || existing.email,
        name: name || existing.name,
        profilePicture: picture || existing.profilePicture,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert("users", {
      clerkId,
      email: email || "",
      name: name || email?.split("@")[0] || "User",
      profilePicture: picture,
      description: undefined,
      contact: email || undefined,
      publicKey: undefined, // filled client-side later for E2E encryption
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

// Get current user profile
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
  },
});

// Update profile editable fields
export const updateProfile = mutation({
  args: {
    description: v.optional(v.string()),
    contact: v.optional(v.string()),
    name: v.optional(v.string()),
    publicKey: v.optional(v.string()),
    defaultRole: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("scrum_master"),
        v.literal("attendee")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      description: args.description ?? user.description,
      contact: args.contact ?? user.contact,
      name: args.name ?? user.name,
      publicKey: args.publicKey ?? user.publicKey,
      defaultRole: args.defaultRole ?? user.defaultRole,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(user._id);
  },
});

// Set default role explicitly (first-time popup)
export const setDefaultRole = mutation({
  args: {
    defaultRole: v.union(
      v.literal("owner"),
      v.literal("scrum_master"),
      v.literal("attendee")
    ),
  },
  handler: async (ctx, { defaultRole }) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { defaultRole, updatedAt: Date.now() });
    return { success: true };
  },
});

// List users by ids (utility for client side hydration)
export const listUsers = query({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const results = [] as any[];
    for (const id of args.ids) {
      const u = await ctx.db.get(id);
      if (u) results.push(u);
    }
    return results;
  },
});

// Get all users (for user picker/dropdown)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      profilePicture: u.profilePicture,
    }));
  },
});
