# Mission Control

`mission-control/` is now the unified operating dashboard for the workspace.

## Operating model

- **Mission** = long-horizon goals, active projects, docs, team structure, office state
- **Command** = today&apos;s execution loop, morning operator plan, focus stack, routine checklist, notes, export-ready memory summary

The old `command-post/` folder is still kept in place as the source reference for the operational ideas that were merged in, but the live app shell is `mission-control/`.

## What the merged dashboard includes

- **Mission Overview** for the strategic and operational split in one screen
- **Command Deck** ported from Command Post concepts
- **Task Board** backed by `data/tasks.json`
- **Calendar / Cron** backed by `data/cron-jobs.json`
- **Projects** from `../memory/projects.json`
- **Memory** from `../memory/YYYY-MM-DD.md` and `../MEMORY.md`
- **Docs** from workspace markdown files
- **Team** and **Office** screens from Mission Control

## Run locally

```bash
cd mission-control
npm install
npm run dev
```

Open <http://localhost:3000>.

For a production check:

```bash
npm run build
```

## Main files

- `src/components/mission-control-dashboard.tsx`
- `src/app/globals.css`
- `data/tasks.json`
- `MERGE_NOTES.md`

## API endpoints

- `/api/overview`
- `/api/tasks`
- `/api/docs`

## Notes

- This is an MVP merge centered on `mission-control/`, not a full rewrite.
- Command Deck state is stored in browser local storage for now.
- The heartbeat-ready task board remains in `data/tasks.json`.
