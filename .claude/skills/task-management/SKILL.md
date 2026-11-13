---
name: task-management
description: >
    Project management skill for creating and managing tasks in the issue tracker
    from OpenSpec artifacts. Use only when the user explicitly asks to create or
    update tasks in the tracker — not on a mere mention of tasks, tickets or sprints.
metadata:
    author: est-ai
    profile: generic
    version: "0.1.0"
    generatedBy: "0.1.0"
---

# Issue Tracker Task Management

The issue tracker is ClickUp. Link tasks as `https://app.clickup.com/t/<task-id>`.

## Approval before writing

The tracker is shared: never create, update or close tasks without approval. First show the full list of changes (task names, descriptions, assignees, statuses) and write to the tracker only after the user approves it.

## Creating Tasks from OpenSpec

When given an OpenSpec change proposal:

1. Read `openspec/changes/<change-name>/tasks.md` for the task breakdown
2. Read `openspec/changes/<change-name>/design.md` for technical context
3. For each task, draft a task for the issue tracker with:
    - **Name**: `[ROLE] Task description`
    - **Description**: Include acceptance criteria from the spec
    - **Priority**: Based on dependency order (blocking tasks = high)
    - **Assignee**: Map to the appropriate agent role
    - **Tags**: Feature name, sprint number
4. Show the drafted tasks to the user and create them only after they approve

## Role-to-Assignee Mapping

| Role Tag | Agent             | Task Type                                   |
| -------- | ----------------- | ------------------------------------------- |
| [BE]     | backend-developer | Library code: HTTP client, endpoints, types |
| [CR]     | code-reviewer     | PR review                                   |

## Task Dependencies

Create tasks in dependency order: a task that changes the generic client comes before the endpoint tasks that use it.

## Task Structure Strategy

Choose the structure based on feature complexity:

**Simple features** (roughly 5 or fewer tasks):

- Create ONE parent issue named: `[Feature name] - Brief description`
- Create subtasks under it for each individual task from tasks.md
- Subtask names: `[ROLE] Task description`

**Complex features** (more than 5 tasks, or multiple parallel tracks):

- Create multiple standalone issues
- Every issue title MUST include the feature name as a prefix so they can be filtered together
- Format: `[Feature name] [ROLE] Task description`

When in doubt, prefer the simple approach (parent + subtasks).

## Status Flow

to do -> in progress -> to test -> done
