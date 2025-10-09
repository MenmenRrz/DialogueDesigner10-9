# API2 Improvement Plan

## Goals
- Reduce fragility in dialogue generation by switching API2 to per-topic calls with localized retries.
- Keep users informed about generation progress and partial failures.
- Ensure existing editing, saving, and graph manipulation features continue to work without surprises.

## Execution Flow
1. When the user clicks `Generate Dialogue`, capture a fingerprint of `convertContent` + topic list. If the fingerprint changed since the last run, discard cached topic graphs.
2. Build a queue of topic jobs (topic id, name, session index, retry count, status).
3. Enter batch mode UI: show a global banner with progress, mark topics as pending.
4. Process queue sequentially (parallelism optional later):
   - Compose a topic-scoped prompt (see Prompt Strategy) and call API2.
   - Set per-topic timeout + retry counter.
   - On success run validation, update `topicGraph` entry, refresh metrics, mark topic done.
   - On failure capture structured error, mark topic failed, surface retry button.
5. After all jobs finish, merge topic scripts into `stateContent`; only successful topics render on canvas.
6. Persist queue + results to `localStorage` (with fingerprint) so refresh restores state mid-run.

## Prompt Strategy
- Provide minimal global context (goal summary, persona, tone) and the specific topic's subtopics (name, brief, miTechnique).
- Explicit instruction: "Generate dialogue for topic <name> only; do not reference other topics."
- Require output in a strict fenced block (for example ```dialogue```) following STATE/AGENT/USERMENU schema, capped at <= 20 states per topic.
- Include metadata (topicId, sessionIndex) in a system note or response headers so we can match responses.

## Validation & Error Handling
- Extend `formatGeneticCounseling` to:
  - Reject duplicate STATE names within a topic.
  - Ensure every USERMENU line contains `=>` and references an existing or new STATE.
  - Verify `end_conversation` exists or append a stub while flagging warning.
  - Return `{ valid: false, topicName, errors: [...] }` when checks fail.
- Only pass validated output to `transform2AntvJson`.
- Record validation failures per topic and expose in UI tooltips.

## Store Changes (`src/stores/designer.ts`)
- Add `generationQueue: TopicJob[]`, where `TopicJob` tracks status, retries, timestamps, lastError.
- Add actions: `startGeneration`, `processNextTopic`, `retryTopic`, `cancelGeneration`, `resumeGeneration`.
- Update `queryTopicStructure` to orchestrate queue instead of single bulk API call.
- Update `captureGraphSnapshot` / `buildWorkspaceFingerprint` to include last generation batch id so restored workspaces match.

## UI Updates
- Convert view header: show slim banner with progress (for example, "Generating topics (3/7)... [Pause] [Cancel]").
- Sidebar topic list: badges/icons for `pending`, `running`, `done`, `failed`; failed items show tooltip with lastError; provide `Retry` button per topic.
- Canvas overlay: when viewing a topic that is pending/running, display placeholder text or spinner instead of stale graph.
- Allow users to continue editing completed topics; disable edits for running topics or warn that changes may be overwritten.

## Robustness Features
- Retry policy: exponential backoff per topic (for example delays 5s, 15s, 45s) up to 3 attempts.
- Cancellation: user stops queue, completed topics remain; pending jobs reset to pending state.
- Timeout: abort topic call if it exceeds configured limit; mark as failed with timeout reason.
- Queue persistence: save queue + partial outputs to storage so reload resumes without loss.
- Instrumentation: optional hook to log per-topic duration, token usage, failure reasons.

## Implementation Roadmap
1. **Phase 1 - Infrastructure**: introduce TopicJob model, queue state, mocked processing loop, basic UI indicators.
2. **Phase 2 - API integration**: wire real per-topic API2 requests, add validation guard rails.
3. **Phase 3 - Persistence & Controls**: add pause/cancel, localStorage persistence, retry buttons.
4. **Phase 4 - Polishing**: refine prompts, add analytics hook, tune UI copy, document behavior.

## Testing Strategy
- Unit tests for new validation helpers (duplicate states, malformed user menu detection).
- Mock queue tests: ensure statuses transition correctly on success/failure/cancel.
- Integration dry-run with stubbed API responses (success, refusal, timeout, invalid schema).
- Manual QA checklist covering: full batch success, partial failures + retry, cancel mid-run, refresh during generation, workspace restore.

## Risks & Mitigations
- **Longer runs**: per-topic sequential calls might increase total time; mitigate via progress feedback and optional limited parallelism later.
- **User edits mid-run**: freeze editing or prompt user before overriding; auto-cancel queue if manual edits occur on running topic.
- **Model drift**: keep prompts versioned; log validation failures to refine instructions quickly.

## Follow-up Ideas
- Combine with future "topic refinement" flow for incremental updates.
- Support generating selected topics only for large plans.
- Add telemetry dashboard for topic success rates and average generation time.
## Implementation Log

### 2025-10-08 每 Audit & Prep
- Current API2 entry point: `queryTopicStructure` in `src/stores/designer.ts` (~line 467) makes a single `client.chat.completions.create` call using entire `sessions_topics` payload.
- Parse helpers: `formatGeneticCounseling` (`src/utils/formatGeneticCounseling.ts:16`) and `transform2AntvJson` (`src/utils/transform2AntvJson.ts:126`) assume whole-script input; no per-topic guards.
- UI relies on `queryTopicStrucLoading` boolean to gate spinner; lacks per-topic status exposure.
- Planned tasks next:
  1. Introduce TopicJob model + queue state in Pinia store.
  2. Split `queryTopicStructure` into dispatcher + per-topic generator.
  3. Extend parsing utilities with validation results.
  4. Wire per-topic status indicators in Convert view.

### 2025-10-08 每 Prompt Hardening
- `src/stores/designer.ts`: replaced generic `//topic 1` output example with stricter directives (OUTPUT TARGET / VALIDATION / FORMAT) enforcing 7每20 states per topic, mandatory user menu structure, and self-check instructions before completion.
### 2025-10-08 每 Prompt Hardening
- `src/stores/designer.ts`: tightened API2 system instructions (OUTPUT TARGET / VALIDATION / FORMAT) to enforce 7每20 states per topic, three `USERMENU` options pointing to declared states, and a self-check with `RETRYING` when constraints fail. Formatted example uses plain text (no code fence) to avoid markdown leaking into the model output.
### 2025-10-08 每 Queue Refactor (In Progress)
- `src/utils/formatGeneticCounseling.ts`: converted to return `DialogueParseResult` with structured issues (duplicate states, malformed menus, missing `end_conversation`).
- `src/stores/designer.ts`: added TopicJob model, queue state, per-topic generation helpers (`clearGraphView`, `buildTopicJobs`, `processTopicQueue`, etc.) and rewrote `queryTopicStructure` to iterate through topics sequentially. Current code compiles syntactically but still needs testing and further cleanup.
- `src/views/designer/Convert.vue`: wired store refs/exports for queue state, added generation banner, per-topic status badges, and warning/error placeholders; helpers now compute queue stats for the UI.
- Remaining work: finish UI command wiring (retry button, disable states when running), ensure type-check passes, and reconcile new store state with auto-save/workspace logic.
