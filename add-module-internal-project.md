# Add Module Internal Project

Date: 9 June 2026

## Objective

Add a new left-navigation module named `Internal Project` in NEXONE as the initial shell for the upcoming internal project management feature.

## Navigation Added

Group:

```text
Internal Project
```

Submenus:

```text
Monitoring
Project
Timesheet
Reports
```

Reserved routes:

```text
/internal-project/dashboard
/internal-project/projects
/internal-project/my-tasks
/internal-project/timesheet
/internal-project/reports
```

Permission keys reserved for future implementation:

```text
internal-project.dashboard
internal-project.projects
internal-project.timesheet
internal-project.reports
```

## Current Behavior

- The module is shown at the top of the grouped left navigation, before `Business & Sales`.
- Navigation labels follow the selected workspace language:
  - English: `Internal Project`, `Monitoring`, `Project`.
  - Bahasa Indonesia: `Proyek Internal`, `Monitoring`, `Proyek`.
- `Project` is active and opens `/internal-project/projects`.
- `Monitoring` is active and opens `/internal-project/dashboard`.
- `Timesheet` is active and opens `/internal-project/timesheet`.
- `Reports` is active and opens `/internal-project/reports`.
- The Project page follows the existing NEXONE UI/UX pattern: page header, summary cards, status tabs, search, responsive table, pagination, modal forms, confirmation dialog, and toast feedback.
- Registered NEXONE users can access the module. Admins see all projects; other users see projects where they are owner/member.
- Project owners and admins can edit project information and manage members. Only admins can permanently delete projects.
- The page supports English and Bahasa Indonesia labels.
- Existing Dashboard and Operations > Projects modules remain unchanged.
- The reserved paths prevent naming conflicts with the existing `/dashboard` and `/projects` routes.

## Terminology Decision

- All user-facing `Dashboard` labels inside the Internal Project module use `Monitoring`.
- English page title: `Internal Project Monitoring`.
- Indonesian page title: `Monitoring Proyek Internal`.
- The technical route `/internal-project/dashboard` remains unchanged.
- The API endpoint `/api/v1/internal-projects/dashboard` remains unchanged.
- The permission key `internal-project.dashboard` remains unchanged.
- Existing Dashboard modules outside Internal Project are not affected.

## File Updated

```text
Frontend/src/config/navigation.ts
Frontend/src/i18n/messages.ts
Frontend/src/pages/InternalProjects/InternalProjectsPage.tsx
Frontend/src/services/api.ts
Frontend/src/store/slices/authSlice.ts
Frontend/src/App.tsx
Frontend/src/components/layout/Layout.tsx
```

## Next Implementation Phase

- Create the Internal Project detail workspace.
- Implement task CRUD and Kanban movement using the isolated internal task tables.
- Calculate project progress from completed internal tasks.
- Build the Internal Project dashboard after task data is available.
- Add configurable role-permission records if access must later be restricted by application role.

## Backend Foundation

The isolated backend foundation uses these tables:

```text
internal_projects
internal_project_members
internal_project_columns
internal_tasks
internal_task_assignees
internal_time_logs
internal_subtasks
internal_task_comments
internal_task_comment_mentions
internal_task_attachments
internal_task_reference_links
internal_task_activities
notifications
```

Initial API scope:

```text
GET    /api/v1/internal-projects
POST   /api/v1/internal-projects
GET    /api/v1/internal-projects/:id
PUT    /api/v1/internal-projects/:id
DELETE /api/v1/internal-projects/:id
GET    /api/v1/internal-projects/:id/members
POST   /api/v1/internal-projects/:id/members
DELETE /api/v1/internal-projects/:id/members/:userId
GET    /api/v1/internal-projects/:id/tasks
POST   /api/v1/internal-projects/:id/tasks
PUT    /api/v1/internal-projects/:id/tasks/:taskId
PATCH  /api/v1/internal-projects/:id/tasks/:taskId/move
DELETE /api/v1/internal-projects/:id/tasks/:taskId
GET    /api/v1/internal-projects/dashboard
GET    /api/v1/internal-projects/time-summary
GET    /api/v1/internal-projects/my-tasks
GET    /api/v1/internal-projects/reports/export
GET    /api/v1/internal-projects/reports/summary
GET    /api/v1/internal-projects/tasks/:id/comments
POST   /api/v1/internal-projects/tasks/:id/comments
DELETE /api/v1/internal-projects/tasks/:id/comments/:commentId
GET    /api/v1/internal-projects/tasks/:id/attachments
POST   /api/v1/internal-projects/tasks/:id/attachments
DELETE /api/v1/internal-projects/tasks/:id/attachments/:attachmentId
GET    /api/v1/internal-projects/tasks/:id/links
POST   /api/v1/internal-projects/tasks/:id/links
DELETE /api/v1/internal-projects/tasks/:id/links/:linkId
GET    /api/v1/internal-projects/tasks/:id/activities
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all
```

Access behavior:

- The creator becomes owner automatically.
- The owner is inserted as the first project member.
- Admins can see all internal projects.
- Other users only see internal projects where they are owner/member.
- Only the owner or an admin can edit the project and manage members.
- Only an admin can delete an internal project.
- Creating a project generates these Kanban columns in order: Backlog, To Do, Development, Review, UAT, Deploy To Production, and Done.

## Detail Workspace And Kanban

The project name in the list opens:

```text
/internal-project/projects/:id
```

The detail workspace now provides:

- Project summary, owner, members, task health, and automatic progress.
- Kanban and task-list views.
- Task create, update, and delete flows.
- Drag-and-drop movement between Backlog, To Do, Development, Review, UAT, Deploy To Production, and Done.
- Multiple assignees selected from registered NEXONE users who are already project members.
- Task category, priority, description, deadline, and overdue indicator.
- Task collaboration for comments, member mentions, attachments, reference links, and activity history.
- English and Bahasa Indonesia labels.
- Project progress calculated from the percentage of tasks in the Done column.

Task access behavior:

- Project members can view, create, edit, and move internal tasks.
- Assignees must already be members of the internal project.
- A task can be deleted by the project owner, task creator, or an admin.
- Internal tasks remain isolated from the existing Operations > Tasks module.

## My Internal Tasks

The contextual page is available at:

```text
/internal-project/my-tasks
```

- Opened from `View all my tasks` on the Internal Project list page.
- It is intentionally not added to the left navigation.
- Shows all tasks assigned to the signed-in user, including completed tasks.
- Provides All, Overdue, Today, Upcoming, and Done tabs.
- Supports search plus project and priority filters.
- Opening a task navigates to its project workspace and opens the task detail modal directly.
- Uses the `internal-project.projects` read permission.

## Internal Project Monitoring

The management monitoring page is available at:

```text
/internal-project/dashboard
```

Monitoring capabilities:

- Summary cards for active projects, completed tasks, overdue tasks, and overall progress.
- Task distribution chart across all seven Kanban stages.
- Project health list with progress, overdue count, high-priority count, task completion, and member count.
- Member workload chart based on assigned open and completed tasks.
- Attention list for overdue, high-priority, and approaching-deadline tasks.
- Filters by internal project, registered project member, and deadline horizon of 7, 30, or 90 days.
- Direct navigation from project health and attention items to the project Kanban workspace.
- Access-aware aggregation: admins see all internal projects, while other users only see projects where they are members.
- English and Bahasa Indonesia labels following the NEXONE locale setting.
- Hours Today and Week use a server-side aggregate in `Asia/Jakarta`, with optional project and member filters.
- The default Hours Today value represents all members across accessible projects.

Permission behavior:

- `internal-project.dashboard` controls Monitoring and its summary endpoint.
- `internal-project.projects` controls project, member, task, subtask, and collaboration access.
- `internal-project.timesheet` controls time-log read and clock-in/clock-out operations.
- `internal-project.reports` controls CSV and printable management reports.
- Frontend navigation, direct routes, and backend APIs enforce the same read/edit permission model.

## Internal Project Reports

The report page is available at:

```text
/internal-project/reports
```

Report capabilities:

- Summary cards for active projects, completed tasks, overdue tasks, high-priority tasks, and overall progress.
- Filters by accessible project, registered project member, and date period.
- Task CSV export with project, category, priority, Kanban status, assignees, deadline, overdue status, and creator.
- Timesheet CSV export with project, task, member, clock-in, clock-out, and duration hours.
- Printable management summary that can be saved as PDF from the browser print dialog.
- Access-aware report queries: admins see all projects, while other users only receive data from projects where they are members.
- English and Bahasa Indonesia labels.
