---
kind: planning
type: plan
split: true
status: in-progress
created: 2026-10-31
updated: 2026-11-12
note: "PR 2 is in review; Task 8 waits on [Q3](../../handoffs/export-jobs.md#q3)."
issues:
  - ref: "foodie-club-app#12"
    title: "Export screen for organizers"
stack:
  - "Django 5.2"
  - "Celery with Redis"
  - "S3 for the files"
  - "Postgres"
related:
  - title: "Spec"
    link: "spec.md"
    note: "What this plan builds"
  - title: "Large exports time out"
    link: "../../risks/export-timeouts.md"
    note: "The risk PR 2 answers"
tasks:
  - { number: 1, status: done }
  - { number: 2, status: done }
  - { number: 3, status: done }
  - { number: 4, status: done, issue: "foodie-club-app#15" }
  - { number: 5, status: in-review, issue: "foodie-club-app#16" }
  - { number: 6, status: in-progress }
  - { number: 7, status: todo }
  - { number: 8, status: todo }
prs:
  - number: 1
    branch: export-screen/01-foundation
    tasks: [1, 2, 3]
    ships: "The screen, writing RSVPs and venues in the request"
    status: done
    pull: "foodie-club-app#14"
  - number: 2
    branch: export-screen/02-background-jobs
    tasks: [4, 5, 6]
    ships: "Every export built by the worker, stored, and emailed as a link"
    status: in-review
    pull: "foodie-club-app#18"
  - number: 3
    branch: export-screen/03-history-and-limits
    tasks: [7, 8]
    ships: "Recent exports on the screen, and a cap per organizer"
---

# Export screen plan

Build the [spec](spec.md) in three pull requests. PR 1 is useful on its
own: RSVPs and venues export from the screen. PR 2 moves every export
into the worker, which is what makes the photo archive possible. PR 3 is polish and
a limit.

::prs

::tasks

# PR 1: Foundation

The screen and the model behind it, with the file written in the request.
Photos stays hidden until PR 2.

### Task 1: The Export model

An `Export` row per request: which organizer, which type, the range, the status, and
later the file. Statuses as in the [spec](spec.md#statuses).

### Task 2: The export screen

The form from the [mockup](brainstorm.md#where-we-landed), behind the
organizer permission. Builds on Task 1.

### Task 3: One writer per type

`RsvpWriter` and `VenueWriter` write CSV rows for a date range;
`PhotoArchiveWriter` streams the photos of the events in the range into a
zip. Tasks 1 to 3 make up PR 1.

# PR 2: Background jobs

Every export runs in the worker. This is the PR that closes the
[timeout risk](../../risks/export-timeouts.md).

### Task 4: Run exports in a Celery job

`build_export(export_id)` loads the row, runs the writer from Task 3 into a
temporary file, and moves the status from Queued to Building to Ready, or
Failed with the error.

### Task 5: Store the file with an expiring link

Upload to the private bucket under `exports/<id>.csv` or `.zip` and keep the key on
the row. Links last seven days ([Q1](../../handoffs/export-jobs.md#q1));
a nightly job deletes the file and marks the row Expired.

**Interfaces:**

- Consumes: the temporary file from Task 4.
- Produces: `Export.download_url()`, which checks the organizer and signs a
  link for five minutes.

- [ ] **Step 1: Write the failing test**

```python
def test_expired_export_has_no_download(export_factory, freezer):
    export = export_factory(status="ready")
    freezer.move_to(export.ready_at + timedelta(days=8))
    expire_exports()
    export.refresh_from_db()
    assert export.status == "expired"
    assert export.download_url() is None
```

- [ ] **Step 2: Run it to see it fail**

Run: `pytest exports/tests/test_expiry.py -v`
Expected: FAIL, `expire_exports` is not defined.

- [ ] **Step 3: Add `expire_exports` and the nightly schedule**

- [ ] **Step 4: Run the whole exports suite, and commit**

Run: `pytest exports -v`
Expected: PASS

### Task 6: Email the link

Send "Your photos export is ready" with the link when the job finishes,
and "Your export failed" with a retry link when it does not. Whether the
screen also shows a notice is [Q4](../../handoffs/export-jobs.md#q4).

# PR 3: History and limits

### Task 7: Recent exports on the screen

The last 20 exports for the signed-in organizer, newest first, with a Download
link while Ready.

### Task 8: A cap per organizer

Refuse a new export over the hourly limit, with a message saying when the
next one is allowed. The number waits on Q3; the approach is decision 0004.

# Self-review notes

- Every task has its PR: Tasks 1 to 8.
- Task 5 and Task 6 can land in either order; Task 4 cannot move.
- Nothing here needs a new service: the worker and Redis already run for
  the event reminder emails.
