# Merge Notes

This document records the MVP merge of `command-post/` into `mission-control/`.

## Center of gravity

The unified dashboard lives in `mission-control/`.

`command-post/` remains in the workspace as a reference artifact, but it is no longer the primary place to run the dashboard.

## What stayed from Mission Control

- Next.js app shell and routing
- Workspace data loading from memory/docs/task files
- Projects, Docs, Memory, Team, and Office screens
- Shared task board and cron screens
- Localhost-first operating model

## What came from Command Post

- Morning operator planning
- Operator history
- Today&apos;s focus stack
- Daily discipline checklist
- Content prompt block
- Quick daily notes
- Project next moves
- Export-ready daily memory summary
- Day review panel

## Practical merge decisions

- Mission and Command are separated in the sidebar navigation.
- Mission Control remains the strategic shell.
- Command Post ideas were adapted as the `Command Deck` screen instead of being kept as a separate app.
- Command Deck state is local browser state for MVP speed.
- Shared workspace data still comes from Mission Control&apos;s existing data and memory sources.

## Run the merged app

```bash
cd mission-control
npm run dev
```

Open <http://localhost:3000>.
