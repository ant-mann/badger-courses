# UW Enroll Auto-Fire Extension Design

## Goal

Build a Chrome extension that maximizes the chance of enrolling as soon as enrollment opens by:

- using whatever classes are already in the current term cart
- auto-navigating to the correct UW Course Search & Enroll page
- preparing the cart and review state before the enrollment window opens
- firing the enrollment request at the exact configured timestamp
- retrying for a short bounded window if the first attempt fails
- falling back to native UI automation if the private enroll API path stops working

The extension should optimize for speed and reliability, but it must not claim or depend on guaranteed "first person" enrollment. The registrar backend and network timing remain outside local control.

## Confirmed Site Behavior

Observed in the live browser session on `https://enroll.wisc.edu/my-courses`:

- the app is a JavaScript SPA, not a normal HTML form flow
- cart enrollment is backed by `POST /api/enroll/v1/enroll/{termCode}`
- the app also uses:
  - `GET /api/enroll/v1/current/{termCode}`
  - `GET /api/pending`
  - `GET /api/lastenrollment`
  - `POST /api/search/v1/enrollmentPackage/{termCode}`
- the page can successfully issue same-origin authenticated `fetch` calls from the logged-in browser session

Captured enroll request shape:

```http
POST /api/enroll/v1/enroll/1272
Accept: application/json, text/plain, */*
Content-Type: application/json
```

Captured request body shape:

```json
[
  {
    "subjectCode": "266",
    "courseId": "004289",
    "classNumber": "35679",
    "options": {
      "credits": 4,
      "waitlist": null,
      "honors": false,
      "relatedClassNumber1": null,
      "relatedClassNumber2": null,
      "classPermissionNumber": null
    }
  }
]
```

This confirms that a browser extension can use the active session to reproduce the site's private enrollment flow without requiring a separate backend service.

## Recommended Approach

Implement a hybrid Chrome extension with:

- an API-first enrollment path for the first and fastest attempts
- bounded retry logic around the same API call
- a UI automation fallback that uses the site's native cart and review flow if the API path fails unexpectedly

This is preferred over pure UI automation because:

- the private enroll API is measurably faster than a click-driven flow
- the payload can be prepared ahead of time
- the request can fire at the exact configured timestamp with less client-side overhead

This is preferred over a backend service because:

- the live authenticated browser session is the source of truth for login state
- same-origin page requests already work in the tab
- a remote backend would add latency and require session/cookie handling that is harder and riskier

## User Workflow

1. Install the extension.
2. Open the extension options and configure:
   - term
   - target enroll timestamp
   - retry window
   - retry interval
3. Log in normally to UW Course Search & Enroll.
4. Put the desired classes in the cart for the selected term.
5. Arm the extension.
6. The extension auto-navigates to the cart page, validates setup, prepares the request payload, and waits.
7. At the exact configured timestamp, the extension sends the API enrollment request.
8. If the result is not a clear success, the extension retries for the configured short window.
9. If the API path fails due to shape or transport issues, the extension falls back to UI automation.
10. The extension reports final status and preserves a log of the run.

## Architecture

### Extension Surfaces

#### Options Page

Stores and edits durable settings:

- selected term code
- target enroll timestamp
- retry window duration
- retry interval
- dry-run mode
- debug logging toggle

#### Popup

Shows live status and lets the user:

- arm the extension
- disarm the extension
- open the target tab
- view current validation results
- inspect the latest attempt log

#### Background Service Worker

Owns orchestration and persistent state:

- countdown and alarm scheduling
- tab discovery and activation
- arming/disarming state
- status transitions
- attempt bookkeeping
- handoff to the content script

#### Content Script

Runs on `https://enroll.wisc.edu/*` and handles:

- page detection and navigation
- same-origin API calls using the active session
- cart inspection
- request payload preparation
- success/failure polling
- UI fallback automation

#### Optional Page-Context Bridge

Inject only if necessary for parity with the site's runtime. This bridge should remain minimal and only exist if content-script fetch behavior proves insufficient in the real implementation.

## State Model

The extension should use a small explicit state machine:

- `idle`
- `validating`
- `arming`
- `preparing`
- `armed`
- `firing`
- `retrying`
- `fallback-ui`
- `succeeded`
- `failed`
- `cancelled`

Each state transition should be timestamped and logged. The popup should display the current state and the latest reason for transitions.

## Preparation Flow

Before the fire time, the content script should:

1. Ensure the user is on `enroll.wisc.edu` and logged in.
2. Navigate to `My Courses` if needed.
3. Ensure the configured term is active.
4. Read the current cart contents for that term.
5. Fail validation if the cart is empty.
6. Build and cache the enroll payload from the cart contents.
7. Optionally open or prepare the review dialog if that reduces last-second work without mutating the cart.
8. Re-validate periodically until fire time in case the session expires or the cart changes.

The extension should not maintain its own saved class list. The cart is the source of truth for what will be attempted.

## Timing Strategy

The extension should target the exact configured enrollment timestamp, not intentionally send early.

To maximize precision without firing early:

- compute local clock drift using available browser/server timing signals where possible
- keep the target tab open and ready before the deadline
- precompute the request payload before the deadline
- avoid expensive DOM work inside the fire window
- send the first API request as close to the corrected target timestamp as possible

The extension may display estimated offset and readiness, but the firing policy should remain "exact target time plus correction," not "intentionally early."

## API-First Enrollment Flow

At fire time:

1. Confirm the session is still valid.
2. Re-read the cart quickly and refresh the payload if it changed.
3. Send `POST /api/enroll/v1/enroll/{termCode}` with the prepared JSON body.
4. Poll `GET /api/pending` and `GET /api/lastenrollment` to determine whether enrollment succeeded, failed, or remains inconclusive.
5. If the response is a transient failure or the outcome remains unclear, continue retries within the bounded retry window.

The implementation should prefer the same request headers and payload shape observed from the live site.

## Retry Policy

The retry policy should be bounded and aggressive:

- first request at the exact target time
- short retry interval
- short overall retry window
- stop immediately on confirmed success
- stop when the retry window expires

The extension should classify outcomes into:

- confirmed success
- validation failure
- session/auth failure
- transient/network failure
- unknown response

Only transient or unknown outcomes should trigger retry.

## UI Fallback Flow

If the API-first path fails due to a request-shape breakage or other unexpected incompatibility, the content script should fall back to UI automation:

1. Navigate to the cart if not already there.
2. Ensure the correct term is selected.
3. Ensure the intended cart items are still present.
4. Open the review dialog if needed.
5. Click the native `Enroll` button.
6. Observe page updates and enrollment status indicators.

UI fallback should not be the first choice because it is slower and more sensitive to rendering changes, but it should provide resilience against API drift.

## Error Handling

### Pre-Fire Validation Errors

Fail early and surface clear warnings for:

- not logged in
- wrong term selected
- empty cart
- target tab not reachable
- required page endpoints unavailable
- target time already passed

### Fire-Time Errors

Handle and log:

- auth/session expiration
- network failures
- malformed or unexpected API responses
- registrar-side validation failures
- missing enrollment result signals
- UI fallback interaction failures

### Logging

Persist a structured run log with:

- state transitions
- validation results
- prepared payload summary
- request attempt times
- response summaries
- final outcome

Sensitive data should be minimized. Logs should avoid storing raw cookies or unrelated account data.

## Testing

### Unit Tests

Test pure logic for:

- countdown and timing calculations
- retry-window decisions
- state transitions
- payload normalization from cart data
- success/failure classification

### Integration Tests

Use mocks or fixtures for:

- API-first immediate success
- API-first delayed success after retry
- session expiry before fire time
- empty cart validation
- API drift causing UI fallback
- UI fallback success and failure

### Manual Verification

Add a dry-run mode that:

- navigates to the target page
- validates term and cart
- prepares the payload
- arms the timer
- stops before sending the enroll request

This allows safe rehearsal before a real enrollment window.

## Proposed File Layout

Initial extension files:

- `extension/manifest.json`
- `extension/src/background.js`
- `extension/src/content.js`
- `extension/src/popup.html`
- `extension/src/popup.js`
- `extension/src/options.html`
- `extension/src/options.js`
- `extension/src/lib/timing.js`
- `extension/src/lib/enroll-api.js`
- `extension/src/lib/cart-parser.js`
- `extension/src/lib/ui-fallback.js`
- `extension/tests/`

If the extension needs a build step, keep it lightweight. If plain ES modules and static assets are sufficient, prefer that over adding a heavy framework.

## Risks And Tradeoffs

### Private API Drift

The enroll API is not public or versioned for third-party use. UW may change payload shape, endpoint behavior, or timing assumptions without notice.

Mitigation:

- isolate API logic in one module
- preserve a UI fallback path
- include dry-run and debug modes

### Session Expiration

The user must remain logged in close to enrollment time.

Mitigation:

- periodic pre-fire validation
- clear session-expiry warnings before fire time

### Timing Uncertainty

Exact local scheduling cannot guarantee first enrollment because other clients, backend ordering, and network conditions vary.

Mitigation:

- precompute payload
- keep the page warm
- use API-first firing
- keep retries tight and bounded

### Cart As Source Of Truth

Using the cart avoids duplicate configuration, but any cart change directly changes what will be attempted.

Mitigation:

- show a cart summary before arming
- revalidate near fire time
- warn when cart contents change while armed

## Success Criteria

The design is successful when:

- the extension can arm against a configured term and exact target timestamp
- it can validate that the user is logged in and has a non-empty cart
- it can prepare an enroll payload from the current cart
- it can send the first enrollment request at the configured timestamp
- it can retry for a short bounded window on transient failure
- it can fall back to UI automation when the API path breaks
- it reports clear status and logs throughout the run
