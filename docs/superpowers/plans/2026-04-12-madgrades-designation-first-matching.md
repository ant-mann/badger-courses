# Madgrades Designation-First Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match more current-term courses to Madgrades by accepting a unique exact designation match even when the title differs.

**Architecture:** Keep the existing course matcher structure, but split the unique-candidate branch into three cases: exact title/alias match, designation-only fallback match, and duplicate-candidate title disambiguation. Surface the fallback as a distinct match method so the broader policy remains visible in data.

**Tech Stack:** Node.js, built-in `node:test`, existing Madgrades matcher/import modules.

---

### Task 1: Add Failing Tests For Designation-Only Fallback

**Files:**
- Modify: `tests/madgrades-match-helpers.test.mjs`

- [ ] **Step 1: Replace the old unique-mismatch expectation**

Update the current regression that expects a unique subject/catalog title mismatch to remain unmatched. Under the new policy it should match with the designation-only fallback method.

- [ ] **Step 2: Keep duplicate disambiguation protection**

Leave the duplicate-candidate title disambiguation tests intact so only the unique-candidate behavior changes.

- [ ] **Step 3: Run matcher tests to verify red**

Run: `node --test tests/madgrades-match-helpers.test.mjs`
Expected: FAIL because the matcher still rejects the unique mismatch case.

### Task 2: Implement The Unique Designation Fallback

**Files:**
- Modify: `src/madgrades/match-helpers.mjs`

- [ ] **Step 1: Preserve stronger evidence when present**

If the unique candidate matches by primary title or alternate title, keep returning the existing strong match method.

- [ ] **Step 2: Add fallback for unique designation-only matches**

If the unique candidate does not match on title or alias, still return a match using a distinct fallback method.

### Task 3: Verify Targeted Suites

**Files:**
- Test: `tests/madgrades-match-helpers.test.mjs`
- Test: `tests/madgrades-import.test.mjs`

- [ ] **Step 1: Run matcher tests**

Run: `node --test tests/madgrades-match-helpers.test.mjs`
Expected: PASS

- [ ] **Step 2: Run importer regression suites**

Run: `node --test tests/madgrades-match-helpers.test.mjs tests/madgrades-import.test.mjs`
Expected: PASS with 0 failures

- [ ] **Step 3: Summarize the policy change**

Document that unique exact designations now match even without title agreement, while duplicate designations still rely on title disambiguation.
