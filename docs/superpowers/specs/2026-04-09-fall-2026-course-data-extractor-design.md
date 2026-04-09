# Fall 2026 Course Data Extractor Design

## Goal

Build a reusable extractor that collects all publicly available University of Wisconsin-Madison Fall 2026 course data from the public Course Search & Enroll site and saves it locally in machine-readable JSON files.

The extractor should prefer the site's structured API over DOM scraping. The browser page already exposes the required endpoints, and those responses contain richer and more stable data than the rendered HTML.

## Confirmed Source

The public search page for Fall 2026 is:

- `https://public.enroll.wisc.edu/search?orderBy=subject&term=1272&closed=true`

Observed behavior in the browser:

- Term code `1272` corresponds to `Fall 2026`
- The search returns `5,625` results
- The site uses `POST /api/search/v1` for paginated course search
- The site uses `GET /api/search/v1/enrollmentPackages/{termCode}/{subjectCode}/{courseId}` for section and package detail

Confirmed course search request shape:

```json
{
  "selectedTerm": "1272",
  "queryString": "*",
  "filters": [
    {
      "has_child": {
        "type": "enrollmentPackage",
        "query": {
          "bool": {
            "must": [
              { "match": { "packageEnrollmentStatus.status": "OPEN WAITLISTED CLOSED" } },
              { "match": { "published": true } }
            ]
          }
        }
      }
    }
  ],
  "page": 1,
  "pageSize": 50,
  "sortOrder": "SUBJECT"
}
```

Confirmed course search response shape:

- top-level fields include `found`, `hits`, `message`, `success`
- `hits` is an array of course-level records

Confirmed enrollment package response shape:

- response is an array of package-detail records for a course
- records include sections, meetings, seats, waitlist data, instructors, materials, and enrollment requirements

## Recommended Approach

Implement a Node script that uses Playwright to open the public search page in a browser context and then fetch data from the same in-page API endpoints.

This approach is preferred over direct `curl` requests because:

- direct shell requests to static assets were blocked by CloudFront during investigation
- the browser session can successfully access the data endpoints
- it stays aligned with the site's real client behavior

## Outputs

The extractor should write:

- `data/fall-2026-courses.json`
- `data/fall-2026-enrollment-packages.json`

`fall-2026-courses.json` should contain the raw course-level records returned by the search API.

`fall-2026-enrollment-packages.json` should contain course detail records enriched from the enrollment package endpoint. Each entry should retain enough identifiers to map back to the source course, especially `termCode`, `subjectCode`, and `courseId`.

## Script Behavior

### Course Collection

1. Launch Playwright and navigate to the Fall 2026 search page.
2. Issue paginated `POST /api/search/v1` requests from the browser context.
3. Continue until all pages have been fetched.
4. Validate that the number of collected course records matches the reported `found` total.
5. Save the aggregated course records to `data/fall-2026-courses.json`.

### Enrollment Package Enrichment

1. For each course record, derive:
   - `termCode`
   - `subject.subjectCode`
   - `courseId`
2. Call `GET /api/search/v1/enrollmentPackages/{termCode}/{subjectCode}/{courseId}`.
3. Collect the returned array for each course.
4. Persist the aggregated detail results to `data/fall-2026-enrollment-packages.json`.

The package-detail phase should be optional via a script flag so the user can choose between:

- faster course-only extraction
- fuller course plus section extraction

## Error Handling

- Fail fast if the initial page does not load or the API returns `success: false`
- Treat missing `hits` arrays as an invalid response
- Log course identifiers for any failed package-detail request
- Continue package enrichment after individual detail failures, then report counts at the end
- Fail the run if course pagination cannot be completed consistently

## Rate Limiting and Resilience

- Use sequential or lightly throttled requests for enrollment package detail
- Avoid unbounded parallelism
- Add a small delay or low concurrency limit to reduce the chance of triggering anti-bot defenses

## Testing

The implementation should start with a small failing test around response-shape normalization and pagination assumptions.

Tests should cover:

- extracting course arrays from a valid search response
- rejecting invalid search responses
- deriving enrollment package endpoint parameters from a course record

Because the upstream site is live and network-dependent, tests should focus on local parsing and validation helpers rather than full live-network end-to-end coverage.

## File Layout

Proposed initial files:

- `package.json`
- `scripts/extract-fall-2026-courses.mjs`
- `tests/extractor.test.mjs`
- `data/` output directory

If helper logic grows, split it into a small module rather than keeping everything in one script.

## Risks and Tradeoffs

### Browser-Context Dependency

Using Playwright is slightly heavier than a plain HTTP script, but it is the more reliable choice in this environment because browser access was confirmed while some direct shell requests were blocked.

### Data Volume

There are at least `5,625` course-level results, and package-detail data will be larger. JSON output size may become substantial, but this is acceptable for a local extraction workflow.

### Mutable Upstream Data

Seat counts, waitlists, and package details can change over time. The extractor should treat outputs as a snapshot of the time the script is run, not a permanent canonical record.

## Success Criteria

The work is successful when:

- the script can fetch all Fall 2026 course-level records
- the output count matches the API's reported total
- optional package enrichment succeeds for most courses and reports any failures clearly
- the output files are written locally and are easy to inspect or reuse downstream
