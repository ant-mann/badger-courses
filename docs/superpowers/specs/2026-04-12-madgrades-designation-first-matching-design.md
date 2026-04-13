# Madgrades Designation-First Matching Design

## Goal

Increase Madgrades coverage for current-term planning by matching a local course to Madgrades whenever there is exactly one live Madgrades course with the same exact designation (subject + catalog number), even if the title differs.

## Rationale

The live Madgrades API currently exposes one course row per exact designation. Many current unmatched local courses already have a single live Madgrades designation match, but the matcher rejects them because titles differ due to renames, abbreviations, or topic drift.

For planning use cases, the user prefers more historical grade coverage over title-perfect precision.

## Policy

- Keep exact subject/catalog matching as the primary key.
- If there are zero designation candidates, stay unmatched.
- If there is exactly one designation candidate, match it.
- If the title or alias also matches, keep the existing stronger match methods.
- If the unique designation candidate only matches on designation, still match it and record a distinct fallback match method.
- If there are multiple designation candidates, keep the current title-based disambiguation path.

## Match Method Semantics

Use a distinct match method for the permissive fallback, such as:

- `subject-code+catalog-number` when primary title or alias evidence aligns
- `subject-code+catalog-number-only` when the only evidence is a unique exact designation match

This preserves observability for downstream auditing.

## Tradeoff

This intentionally accepts some semantic mismatches where the local course title has drifted from the historical Madgrades identity, but the exact designation still aligns.

That is an explicit product tradeoff for coverage.

## Testing

Add regression tests that prove:

1. A unique designation candidate with a different title still matches via the fallback.
2. The BIOCHEM 104 rename case still matches.
3. Duplicate designation candidates still require title disambiguation.
