# UW Program Requirements Planner Dataset Design

## Goal

Build a one-off extractor that collects undergraduate major and certificate requirements from the University of Wisconsin-Madison Guide and saves them in a planner-oriented dataset.

The dataset should support a future workflow where a student provides completed UW-Madison courses and the system can answer:

- which requirements are already satisfied
- which requirements are still missing
- which requirements need manual review because the rule could not be normalized confidently

This is not a registrar-grade audit engine. The design favors high-confidence structure plus explicit manual-review flags over brittle full automation.

## Scope

Version one should cover:

- all undergraduate majors and certificates listed on `https://guide.wisc.edu/explore-majors/`
- program-specific `How to Get in` and `Requirements` content
- shared university and college requirement sections that materially affect degree planning, especially:
  - university general education
  - college-wide degree requirements
  - L&S breadth and related degree rules

The current explore page exposes roughly `332` undergraduate program links. The extractor should be designed for the full catalog rather than a small hand-picked subset.

Version one should not attempt to fully solve:

- transfer-course equivalencies from other institutions
- advisor-approved substitutions and waivers
- AP, IB, CLEP, A-Level, and portfolio credit matching

Those external-credit sources may be added immediately after version one as a separate equivalency layer. The requirement dataset should remain centered on canonical UW-Madison rules.

## Primary Use Case

The dataset is intended for planning rather than passive reference.

The future consumer should be able to compare a student's completed UW-Madison courses against program requirements and determine:

- exact matches against required courses or course groups
- partially satisfied grouped requirements such as "choose two" or "at least 14 credits"
- unresolved requirements that still need a person to inspect the original wording

## Recommended Data Model

Each program record should preserve both:

- normalized planner fields for high-confidence matching
- raw source wording for fallback and manual review

### Program Record

Each record should include:

- `program_id`
- `program_title`
- `program_type`
- `degree_award`
- `school_or_college`
- `department`
- `url`
- `catalog_year`
- `admission`
- `requirements`
- `requirement_groups`
- `shared_requirements`
- `honors_requirements`
- `source_sections`
- `parse_confidence`
- `normalization_warnings`

### Admission

`admission` should include:

- `summary`
- `courses_required`
- `gpa_requirement`
- `credit_requirement`
- `other_requirements`
- `restrictions_or_exclusions`

This section should be populated from `How to Get in` content. Table-based admission rules can usually be normalized well.

### Requirements

`requirements` should include common top-level fields that planners and filters will likely use:

- `total_credits`
- `gpa_requirement`
- `residence_requirement`
- `completion_requirement`
- `notes`

These fields should only be populated when the extractor can do so confidently.

### Requirement Groups

The core modeling unit should be `requirement_groups`, not a flattened `required_courses` list.

Each group should describe one bounded requirement bucket, for example:

- `Required Course`
- `Two courses numbered 400-679`
- `Literature`
- `Biomedical Engineering Core Courses`
- `Residence and Quality of Work`

Each group should support:

- `label`
- `scope`
- `rule_text`
- `match_mode`
- `min_courses`
- `min_credits`
- `exact_credits`
- `courses`
- `course_ranges`
- `subgroups`
- `exceptions`
- `notes`
- `manual_review_needed`

Suggested `match_mode` values:

- `exact_course`
- `course_range`
- `pick_n`
- `credit_bucket`
- `narrative_rule`
- `mixed`

This hybrid structure is the main guardrail against over-normalization. If a group cannot be reduced safely to machine logic, it should still be preserved as a structured group with raw wording and a manual-review flag.

### Shared Requirements

Shared degree rules should be modeled separately from program-specific rules.

`shared_requirements` should capture sections such as:

- university general education
- college-wide BA or BS requirements
- L&S breadth
- university degree requirements

Each shared requirement should include:

- `label`
- `scope`
- `rule_text`
- `requirement_groups`
- `manual_review_needed`

This separation allows the future planner to reason about program-specific rules and shared degree rules independently.

### Honors and Similar Optional Paths

Optional sections like `Honors in the Major` should not be merged into the base program path.

`honors_requirements` should preserve the section when present, including:

- `label`
- `rule_text`
- `requirement_groups`
- `manual_review_needed`

## Source Extraction Strategy

The extractor should use the UW Guide HTML pages directly.

The Guide pages are server-rendered and fetchable without a browser session, so the extractor should prefer a plain HTTP + HTML parsing stack over Playwright. For consistency with the current repo, the implementation should stay in ESM `.mjs` files and use lightweight HTML parsing in Node.

Recommended runtime shape:

- `node` with ESM `.mjs`
- built-in `fetch` for HTTP requests
- a lightweight HTML parser such as `cheerio`

Playwright is not required for version one unless the site behavior changes and direct HTML fetching stops being reliable.

### Pass 1: Collect Programs

From the explore page, collect:

- program title
- program URL
- visible credential cues such as `BA`, `BS`, or `Certificate`
- any lightweight metadata that can be derived from the URL path

This pass should use `https://guide.wisc.edu/explore-majors/` as the canonical program index.

### Pass 2: Extract Program Details

For each program page, extract:

- `How to Get in`
- `Requirements`
- nested headings inside `Requirements`
- special sections such as:
  - `Certificate Completion Requirement`
  - `Residence and Quality of Work`
  - `Honors in the Major`
  - `University Degree Requirements`

The extractor should use heading boundaries to segment the page into sections and then normalize each section independently.

### Shared Requirement Sources

The extractor should pin shared requirements to specific Guide sources instead of treating them as generic prose.

Canonical shared source pages for early phases:

- university-wide undergraduate degree and general education requirements:
  - `https://guide.wisc.edu/undergraduate/#requirementsforundergraduatestudytext`
- future AP/IB/CLEP equivalency layer:
  - `https://guide.wisc.edu/undergraduate/#AdvancedPlacementInternationalBaccalaureate`

College-wide rules should come from the relevant program pages when the Guide embeds them directly in `Requirements`. For example, many L&S program pages include their own shared sections such as:

- `College of Letters & Science Degree Requirements: Bachelor of Arts (BA)`
- `College of Letters & Science Degree Requirements: Bachelor of Science (BS)`

The extractor should preserve these sections as shared requirements and may deduplicate them later by source label plus normalized text hash.

## Parsing Strategy

### High-Confidence Parsing

The extractor should normalize these patterns aggressively:

- admission tables with row labels such as `Courses required to get in`
- course tables with explicit rows and total-credit summaries
- straightforward GPA and residence prose
- obvious exclusions such as majors that cannot declare a certificate

### Conservative Parsing

The extractor should be conservative with:

- prose-heavy category descriptions
- complex nested course options
- footnotes that materially alter a rule
- cross-cutting exceptions and advisor approvals

For those cases, prefer:

- preserving `rule_text`
- attaching extracted course references when possible
- setting `manual_review_needed: true`
- emitting a warning into `normalization_warnings`

## Politeness, Throttling, and Resilience

Although the Guide is publicly accessible, the extractor should behave politely because it will fetch a few hundred pages in one run.

Recommended safeguards:

- sequential fetching by default
- a small delay between requests
- retry with backoff for transient failures such as `429`, `500`, `502`, `503`, and `504`
- clear progress logging so interrupted runs are diagnosable

The implementation does not need aggressive concurrency in version one.

## Course Normalization

Course identity should remain in UW-Madison canonical terms.

When possible, course parsing should capture:

- subject and catalog number as a normalized course code
- cross-listed variants when visible
- explicit course ranges, such as `303 through 699`
- group-level total credits

The extractor should not claim that a program has one definitive flat course list if the page really defines the program through grouped logic.

Instead, the future planner should derive "what is left" by evaluating `requirement_groups`.

## Matching Model for the Future Planner

The future planner should evaluate requirements in layers:

1. exact course matches against canonical UW course codes
2. grouped rule evaluation such as `pick_n` and `min_credits`
3. unresolved narrative or exception-driven requirements flagged for manual review

This design intentionally keeps equivalency handling separate.

Phase two may add an external-credit matching layer for:

- AP
- IB
- CLEP
- A-Level

using the undergraduate Guide's placement and credit-by-exam sections as a separate source of truth.

## Output

The extractor should write one planner-oriented JSON snapshot, for example:

- `data/uw-undergraduate-program-requirements.json`

The output should be easy to inspect and stable enough for downstream matching logic.

The snapshot may be fairly large. A full-catalog JSON file with raw source sections could plausibly land in the `10–20 MB` range. The implementation should treat the snapshot as a generated artifact and avoid assuming it should always be committed to git by default.

## Error Handling

- fail when the explore page cannot be parsed into program links
- fail when a program page cannot be fetched
- continue when an individual section cannot be fully normalized, but record warnings
- preserve raw section content whenever normalization is incomplete
- track the overall confidence per program

## Success Criteria

The work is successful when:

- all programs from the explore page are collected
- each program has structured admission and requirements data where available
- grouped requirements preserve enough logic to support future "what am I missing?" workflows
- shared university and college rules are captured distinctly from program-specific rules
- ambiguous requirements are clearly marked for manual review instead of being guessed

## Recommended Next Step

After this design is approved, the implementation plan should focus on a narrow first slice:

1. extract program URLs and metadata
2. parse a small sample of representative programs
3. prove the `requirement_groups` schema against majors and certificates
4. expand to the full catalog once the sample output is trustworthy

Recommended sample programs:

- `Accounting, Certificate`
- `Computer Sciences, Certificate`
- `African American Studies, BA`
- `Biomedical Engineering, BS`

These samples intentionally cover:

- a simpler certificate with explicit credit and GPA rules
- a certificate with exclusions and elective buckets
- an L&S major with shared college requirements and grouped major rules
- an engineering major with dense category tables and larger requirement structure
