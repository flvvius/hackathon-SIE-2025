# Notification System - Implementation Summary

## Overview

Comprehensive notification system with real-time updates, toast notifications, and inbox display.

## Features Implemented

### Backend (Convex)

#### 1. Notifications Mutations (`notifications.ts`)

- `createNotification` - Create new notification
- `markRead` - Mark single notification as read
- `markAllAsRead` - Mark all user notifications as read
- `deleteNotification` - Delete notification
- `getUnreadCount` - Get count of unread notifications
- `myNotifications` - Query user's notifications with optional unread filter

#### 2. Notification Triggers

**Task Delegation** (`tasks.ts` - delegateTask mutation):

- Triggers when: Task is delegated to another user
- Notifies: The assignee
- Type: `task_delegated`
- Message: "{Name} delegated a task to you"

**Task Completion** (`tasks.ts` - updateStatus mutation):

- Triggers when: Task status changes to "Done"
- Notifies: All owners and scrum masters in the group (except completer)
- Type: `task_completed`
- Message: "{Name} marked a task as done"

**Subtask Completion** (`subtasks.ts` - toggleComplete mutation):

- Triggers when: Subtask is marked complete
- Notifies: All scrum masters in the group (except completer)
- Type: `subtask_completed`
- Message: "{Name} completed a subtask"

**Group Invitation** (`groups.ts` - addMember/addMemberById mutations):

- Triggers when: User is added to a group
- Notifies: The newly added user
- Type: `group_invite`
- Message: "{Name} added you to {Group Name}"

### Frontend (React Native)

#### 1. Inbox Tab (`apps/native/app/(tabs)/inbox.tsx`)

Features:

- Display all notifications (read and unread)
- Visual distinction for unread (blue background/text)
- Pull-to-refresh
- Click notification to navigate to related content
- Mark individual notification as read (auto on click)
- Mark all as read button
- Unread count badge in header
- Time formatting (just now, Xm/h/d ago)
- Empty state with icon
- Notification type icons (📋 📭 ✅ ✓ 👥 ⏰ @)

#### 2. Tab Badge (`apps/native/app/(tabs)/_layout.tsx`)

- Shows unread count on Inbox tab icon
- Updates in real-time via `getUnreadCount` query

#### 3. Toast Notifications (`apps/native/components/notification-provider.tsx`)

Features:

- Animated slide-in from top
- Auto-dismiss after 4 seconds
- Click to navigate to related content
- Manual dismiss with X button
- Real-time subscription to new notifications
- Shows latest unread notification automatically
- iPhone-style design (white bg, blue border, shadow)
- Positioned at top with safe area
- Icons matching notification type

## Notification Types

| Type                   | Icon | Trigger           | Who Gets Notified      |
| ---------------------- | ---- | ----------------- | ---------------------- |
| `task_delegated`       | 📋   | Task delegated    | Assignee               |
| `task_assigned`        | 📋   | Task assigned     | Assignee               |
| `task_completed`       | ✅   | Task marked done  | Owners + Scrum Masters |
| `subtask_completed`    | ✓    | Subtask completed | Scrum Masters          |
| `group_invite`         | 👥   | Added to group    | New member             |
| `deadline_approaching` | ⏰   | Deadline near     | (Not implemented)      |
| `mention`              | @    | User mentioned    | Mentioned user         |
| `task_updated`         | 🔔   | Task edited       | (Not implemented)      |

## User Experience Flow

### When a notification is created:

1. Backend mutation creates notification in database
2. Real-time subscription delivers notification to user
3. Toast appears at top of screen (if app is open)
4. Toast auto-dismisses after 4 seconds
5. Unread badge updates on Inbox tab
6. Notification appears in Inbox tab

### When user interacts:

1. Click toast → Navigate to related content + dismiss
2. Click X on toast → Dismiss immediately
3. Click notification in Inbox → Mark as read + navigate
4. Click "Mark all read" → Mark all as read
5. Pull down in Inbox → Refresh notifications

## Role-Based Notifications

- **Owners**: Receive task completion notifications
- **Scrum Masters**: Receive task completion + subtask completion notifications
- **Attendees**: Receive task delegation notifications
- **All**: Receive group invitation notifications

## Technical Details

### Real-time Updates

- Uses Convex subscriptions via `useQuery`
- Automatically updates when new notifications arrive
- No polling needed - purely reactive

### Navigation

- Toast and Inbox both support deep linking
- Navigate to `/task/[id]` for task-related notifications
- Navigate to `/group/[id]` for group-related notifications

### Styling

- Unread: Blue background, bold text
- Read: Normal card background, regular text
- Toast: White/dark bg, blue border, shadow

### Performance

- Efficient queries with proper indexing
- Only queries unread for badge count
- Toast shows only latest notification (no queue)

## Future Enhancements

Possible additions:

- Notification queue for multiple simultaneous notifications
- Push notifications (Expo Notifications)
- Notification preferences/settings
- Mute notifications per group
- Notification sound/vibration
- Email digest of notifications
- Mark as unread
- Notification history pagination
