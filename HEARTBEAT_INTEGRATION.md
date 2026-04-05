# Mission Control Heartbeat Integration

## Goal
Make heartbeat checks action-oriented by letting OpenClaw read the Mission Control task board and identify work explicitly assigned to the main agent.

## Source of truth
Use:
- `mission-control/data/tasks.json`

Primary assignee values to treat as "my tasks":
- `openclaw-main`
- `Mwakulomba`

## Heartbeat selection rule
On each heartbeat:
1. Read `mission-control/data/tasks.json`
2. Filter tasks where:
   - `assignee` is `openclaw-main` or `Mwakulomba`
   - `status` is `backlog`, `assigned`, or `in_progress`
3. Sort by:
   - `priority` (`high` > `medium` > `low`)
   - then nearest `dueDate`
4. Choose **one** task only
5. Do one concrete internal step that advances it
6. Reply with the progress update only if something meaningful changed; otherwise reply `HEARTBEAT_OK`

## Status meaning
- `backlog` — not yet started but available to pick up
- `assigned` — should be worked next
- `in_progress` — continue existing work
- `review` — summarize, verify, or prepare next move
- `done` — ignore in heartbeat selection

## Recommended task handling behavior
### If selected task is build-related
- create or improve one concrete asset: spec, implementation file, UI screen, data model, integration note, or debugging fix
- do not just restate the task board

### If selected task is research/planning-related
- produce one reusable execution artifact
- examples: roadmap, checklist, schema, prompt pack, categorization system

### If task is blocked
- say exactly what is blocked
- name the unblock step
- avoid vague status updates

## Suggested future implementation path
### Option A — lightweight file-driven heartbeat (fastest)
Extend the heartbeat routine to:
- read `tasks.json`
- compute top assigned task
- include it in the heartbeat action loop

### Option B — Mission Control API-driven heartbeat
Once localhost app is stable, heartbeat can read:
- `/api/tasks`
- or `/api/overview`

This makes the same logic visible in both the UI and the heartbeat workflow.

## Example decision logic
```txt
if any high-priority in_progress task for openclaw-main:
  continue that task
else if any high-priority assigned/backlog task for openclaw-main:
  start the top one
else if any medium-priority assigned task for Mwakulomba:
  do the smallest meaningful step
else:
  HEARTBEAT_OK
```

## First tasks this should govern
1. `MC-001` — Finish Mission Control local dashboard MVP
2. `OPS-002` — Design heartbeat-to-task-board workflow
3. `HOU-014` — Turn Housify into investor-testable MVP
4. `DOC-003` — Categorize prior workspace planning documents

## What this unlocks
- heartbeats become execution-aware instead of passive
- Mission Control becomes a real operating surface, not just a dashboard
- assigned tasks can drive autonomous progress without relying on chat memory
