# Madgrades Renamed Course Matching Design

## Goal

Match local courses to Madgrades when the subject/catalog pair is still the same but the primary course title has changed over time, without reintroducing the earlier overmatching bug for unrelated unique subject/catalog candidates.

## Problem

`BIOCHEM 104` is present in the live Madgrades API, but its current primary title is now `Molecular Mechanisms, Human Health & You` while the local Fall 2026 course title is `Molecules to Life and the Nature of Science`.

The current matcher rejects this course because the unique subject/catalog candidate fails the normalized primary-title check.

## Recommended Approach

Use Madgrades alternate names as additional matching evidence.

- Keep subject/catalog matching as the first filter.
- Keep current behavior for ambiguous duplicate subject/catalog candidates.
- For a unique subject/catalog candidate, allow a match when either:
  - the primary Madgrades title matches the local title after normalization, or
  - any Madgrades alternate title from `names[]` matches the local title after normalization.

This preserves the earlier overmatching protection while allowing renamed-course cases to match.

## Why Not Match Unique Subject/Catalog Unconditionally

That broader rule previously produced false positives, because some subject/catalog pairs are unique in the current Madgrades index but still represent a materially different course title than the local registrar row.

Using `names[]` is a narrower signal tied to the upstream course record itself.

## Data Flow Changes

- Extend the normalized Madgrades course shape used for matching to include normalized alternate names derived from the live API `names[]` field.
- Update `matchLocalCourse()` so the unique-candidate path checks both the primary normalized title and normalized alternate names.

## Testing

Add a failing regression test that simulates the BIOCHEM 104 case:

- local title: `Molecules to Life and the Nature of Science`
- Madgrades title: `Molecular Mechanisms, Human Health & You`
- Madgrades `names[]`: includes `Molecules to Life & Science`

The test should prove the course matches only because the alias evidence exists.

Also keep the existing regression that prevents a unique subject/catalog candidate with a mismatched title from auto-matching when no alias evidence exists.
