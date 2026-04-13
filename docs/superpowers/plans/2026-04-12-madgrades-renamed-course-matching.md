# Madgrades Renamed Course Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match renamed courses like `BIOCHEM 104` against Madgrades using alternate titles from the live API without reopening the prior unique-subject/code overmatching bug.

**Architecture:** Keep the existing subject/catalog-first course matcher, extend the normalized matching input to carry alternate names, and only relax the unique-candidate rejection when a normalized alternate title matches the local title. This keeps the change local to matching logic and tests.

**Tech Stack:** Node.js, built-in `node:test`, existing Madgrades matcher/import modules.

---

### Task 1: Add A Failing Alias-Match Regression Test

**Files:**
- Modify: `tests/madgrades-match-helpers.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a matcher test where the local course is `BIOCHEM 104` with title `Molecules to Life and the Nature of Science`, and the only Madgrades subject/catalog candidate has primary title `Molecular Mechanisms, Human Health & You` plus alternate name `Molecules to Life & Science`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/madgrades-match-helpers.test.mjs`
Expected: FAIL because alternate names are not used yet.

### Task 2: Implement Alias-Aware Unique Matching

**Files:**
- Modify: `src/madgrades/import-runner.mjs`
- Modify: `src/madgrades/match-helpers.mjs`

- [ ] **Step 1: Extend normalized course matching data**

Carry normalized alternate names from Madgrades `names[]` into the course objects used for matching.

- [ ] **Step 2: Update unique subject/catalog matching path**

Allow the unique candidate to match when either the primary normalized title or any normalized alternate title matches the local title.

- [ ] **Step 3: Preserve existing mismatch guard**

If the unique candidate has neither a primary-title nor alternate-title match, keep returning unmatched.

### Task 3: Verify Targeted Coverage

**Files:**
- Test: `tests/madgrades-match-helpers.test.mjs`
- Test: `tests/madgrades-import.test.mjs`

- [ ] **Step 1: Run matcher tests**

Run: `node --test tests/madgrades-match-helpers.test.mjs`
Expected: PASS

- [ ] **Step 2: Run Madgrades importer regression suites**

Run: `node --test tests/madgrades-match-helpers.test.mjs tests/madgrades-import.test.mjs`
Expected: PASS with 0 failures

- [ ] **Step 3: Summarize the matcher behavior**

Document that renamed courses can now match via live Madgrades `names[]`, while unrelated title mismatches still remain unmatched.
