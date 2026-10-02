#!/usr/bin/env bash
# SessionStart hook: install workspace dependencies in Claude Code cloud sessions.
# No-op locally — CLAUDE_CODE_REMOTE is only "true" on the cloud VM. The toolchain
# (pnpm, openspec, lsof) comes from the cloud environment's setup script.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
pnpm install --frozen-lockfile --prefer-offline || echo "cloud-session-start: pnpm install failed (non-fatal)" >&2
exit 0
