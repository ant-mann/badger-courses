# Madgrades Import Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add richer forward progress indicators to `scripts/import-madgrades.mjs --refresh-api` while preserving `stderr` progress output and `stdout` JSON output.

**Architecture:** Extend the existing `onProgress` reporting in `src/madgrades/import-runner.mjs` rather than introducing a new progress subsystem. Add count-based phase messages around matching, deduping, normalization, and snapshot assembly, and keep the DB-import side lightweight by emitting pre-import row summaries instead of refactoring the table replacement helper.

**Tech Stack:** Node.js, built-in `node:test`, existing Madgrades importer modules.

---

### Task 1: Add A Failing CLI Progress Regression Test

**Files:**
- Modify: `tests/madgrades-cli.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a new test that runs the CLI with `--refresh-api` using a small mocked API and asserts that `stderr` includes additional forward-progress messages such as local-count loading, index counts, dedupe counts, normalization, and snapshot-row preparation.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/madgrades-cli.test.mjs`
Expected: FAIL because the new progress messages are not emitted yet.

- [ ] **Step 3: Keep the assertions resilient**

Assert a few representative messages with regex instead of the full exact log so the test stays stable while still protecting the new behavior.

### Task 2: Add Progress Messages In API Snapshot Building

**Files:**
- Modify: `src/madgrades/import-runner.mjs`
- Test: `tests/madgrades-cli.test.mjs`

- [ ] **Step 1: Add phase and count messages around local loading and remote index fetches**

Emit messages for loaded local counts and fetched remote index counts.

- [ ] **Step 2: Add matching and dedupe messages**

Emit messages before matching starts and after unique course/instructor fetch targets are known.

- [ ] **Step 3: Add normalization progress reporters**

Reuse the existing periodic reporter pattern for course and instructor normalization loops so long post-fetch processing still shows forward motion.

- [ ] **Step 4: Add snapshot row-count summary**

Before writing the snapshot, emit a compact summary of prepared row counts so the user sees the importer moving into output generation.

### Task 3: Keep SQLite Import Progress Lightweight

**Files:**
- Modify: `src/madgrades/import-runner.mjs`

- [ ] **Step 1: Keep existing SQLite import start/end messages**

Do not refactor `replaceMadgradesTables()` unless required.

- [ ] **Step 2: Ensure the pre-import summary makes DB work feel preceded by visible progress**

Use the row summary from Task 2 so the user has concrete context before the import step starts.

### Task 4: Verify The Full Madgrades Suite

**Files:**
- Test: `tests/madgrades-cli.test.mjs`
- Test: `tests/madgrades-import.test.mjs`
- Test: `tests/madgrades-match-helpers.test.mjs`

- [ ] **Step 1: Run CLI tests**

Run: `node --test tests/madgrades-cli.test.mjs`
Expected: PASS

- [ ] **Step 2: Run targeted Madgrades suites**

Run: `node --test tests/madgrades-match-helpers.test.mjs tests/madgrades-import.test.mjs tests/madgrades-cli.test.mjs`
Expected: PASS with 0 failures

- [ ] **Step 3: Summarize the new progress output behavior**

Record the important new progress phases in the final handoff so the user knows what to expect when running `--refresh-api`.
