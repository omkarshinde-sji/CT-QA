# Technical Decisions

## AI Streaming Architecture

Decision:
Use SSE (Server-Sent Events) instead of WebSockets for AI streaming responses.

Reason:
- simpler implementation
- easier scaling
- works well for one-way AI token streaming
- lower infrastructure complexity

Status:
Active architecture pattern

## Four Spaces Information Architecture

Decision:
Reorganize navigation into four workspaces (Sales, Knowledge, Operations, EOS) with space-prefixed routes, unified `SpaceLayout`, and legacy redirects. Rollout gated by `features.enableFourSpaces` in `app_config`.

Reason:
- Reduce sidebar complexity and admin/app duplication
- Role-focused discoverability
- Backward-compatible migration via redirects

Status:
Implemented (feature flag off by default). See `docs/specs/four-spaces-ia.md`.

## TestPilot / Spec2Test AI

Decision:
Implement QA intelligence as a dedicated `testpilot` module with edge function `testpilot-generate`, shared agent pipeline under `supabase/functions/_shared/testpilot/`, and cached reports in `qa_reports`.

Reason:
- Combines Actions task context + GitHub PR diffs + project module manifest for focused tester briefs
- Avoids duplicate LLM calls via `context_hash` cache keyed on task update + PR head SHA
- Server-side GitHub PAT keeps secrets out of the client (MVP); OAuth can be added later

Status:
Implemented. Feature flag `enableTestPilot`. Requires `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` edge secrets.