/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_auditLog from "../_lib/auditLog.js";
import type * as _lib_permissions from "../_lib/permissions.js";
import type * as auditLogs from "../auditLogs.js";
import type * as comments from "../comments.js";
import type * as groups from "../groups.js";
import type * as healthCheck from "../healthCheck.js";
import type * as notifications from "../notifications.js";
import type * as privateData from "../privateData.js";
import type * as subtasks from "../subtasks.js";
import type * as tasks from "../tasks.js";
import type * as todos from "../todos.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "_lib/auditLog": typeof _lib_auditLog;
  "_lib/permissions": typeof _lib_permissions;
  auditLogs: typeof auditLogs;
  comments: typeof comments;
  groups: typeof groups;
  healthCheck: typeof healthCheck;
  notifications: typeof notifications;
  privateData: typeof privateData;
  subtasks: typeof subtasks;
  tasks: typeof tasks;
  todos: typeof todos;
  users: typeof users;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
