# Agent Ledger

## Project Snapshot
- Repository: `DialogueDesigner-3.28` (backed up under `DialogueDesigner-10.5Backup`).
- Front-end stack: Vue 3 (script setup), Pinia state management, Ant Design Vue widgets, AntV X6 graph canvas.
- Primary workflow: Import step collects authoring context → API1 generates topic plan → Convert step visualises and edits dialogue graph → optional persistence in browser storage.

## Architecture Notes
- `src/stores/designer.ts` is the central Pinia store. It maintains `sessionTopics`, `api1Result`, `topicGraph` (per-topic AntV cell snapshots), `graph` instance, and helper actions such as `convert2topic`, `queryTopicStructure`, `selectGraphTopic`, and `updateSelectedGraphTopic`.
- Graph rendering relies on AntV X6 with two custom nodes (`StageNode.vue` and `OptionNode.vue`). `StageNode` exposes editing, suggestion tooling, and now keeps its `agent` text synchronised with the underlying X6 node via a watcher.
- Import review UI (`Import.vue`) pulls plans from the store, now with augmented metadata (`topicDetailLookup`) so the preview panel surfaces subtopic brief + MI technique returned by API1.

## Key Enhancements
### Import Step Improvements
- Added `api1Result` to the view bindings so review panels can read the raw API1 payload.
- Introduced `topicDetailLookup`: normalises `all_topics` structures into a name → detail map and hydrates missing `brief` / `miTechnique` fields inside review cards.

### API1 Prompt Updates
- `convert2topic` system prompt now mandates object outputs for every subtopic (`name`, `brief`, `mi_technique`) and contains a new example JSON matching that schema.
- Authoring context (goal, age range, gender, persona) continues to be injected via `buildAuthoringContext()` every request.

### Graph Conversion (`transform2AntvJson.ts`)
- Reworked to ensure every state is instantiated exactly once, columns laid out via BFS depth mapping, and cross-topic references (e.g., `end_conversation`) receive placeholder nodes so the canvas renders the full FSM.

### Convert Screen UX (`Convert.vue`)
- Header now contains `Create State`, `Export`, and `Save` buttons plus a live auto-save status indicator.
- Added topic metrics: displays stage count, total agent word count, and estimated dialogue duration (words ÷ 200 wpm). Metrics refresh when topics switch, on manual/auto save, and when graph edits occur.
- Implemented local workspace save/restore:
  - `persistWorkspace()` captures `planTopics`, per-topic graph cells, selected topic, `convertContent`, and `stateContent`, writing to `localStorage` under `designer-convert-workspace`.
  - Added `buildWorkspaceFingerprint()` stored at `designer-convert-fingerprint`; restore only succeeds when the fingerprint matches the current session (guards against loading a previous API run).
  - Auto-save timer (2 minutes) refreshes the status text and persists the same snapshot. Graph change events (`node/edge added/removed`, `node:change:data`) feed `captureGraphSnapshot()` so the store cache stays in sync before saves.
- `restoreWorkspace()` hydrates plan topics, graph map, script text, and reselects last topic when the fingerprint matches; otherwise, stale data is cleared.

### Stage Node Component (`StageNode.vue`)
- Added watcher on the `agent` ref to write changes back into X6 node data, ensuring manual edits survive persistence and reload.
- Editing the title already persisted via `onEditOk`; suggestion tooling uses the synced data for previews.

## Persistence Flow Summary
1. User edits dialogue → AntV triggers `captureGraphSnapshot()` on relevant events to keep `topicGraph` current.
2. Manual `Save` or auto-save calls `persistWorkspace()` → updates snapshots and fingerprint.
3. On load, `restoreWorkspace()` compares saved fingerprint with the current session (derived from `api1Result` / `convertContent`). Only matching fingerprints restore; mismatches wipe storage to avoid user confusion after a fresh API1 run.

## Usage Tips
- To reset the workspace manually, clear `designer-convert-workspace` and `designer-convert-fingerprint` from browser storage.
- Regeneration flow: start from Import → Generate Dialogue (which now guards against duplicate API2 calls and auto navigates to Convert).
- Any prompt tweaks for API1 must keep the `name/brief/mi_technique` shape; review panel depends on it.
