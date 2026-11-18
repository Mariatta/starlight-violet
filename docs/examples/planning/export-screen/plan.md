---
kind: planning
type: plan
split: true
status: in-progress
created: 2026-10-31
updated: 2026-11-12
note: "PR 2 is under way: Task 5 is in review, Task 6 is next. Task 8 waits on [Q3](../../handoffs/export-jobs.md#q3)."
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
    ships: "The model, the writers and the screen, behind a flag"
    status: done
    pull: "foodie-club-app#14"
  - number: 2
    branch: export-screen/02-background-jobs
    tasks: [4, 5, 6]
    ships: "Every export built by the export worker, stored and emailed as a link; the screen turned on"
    status: in-progress
    pull: "foodie-club-app#18"
  - number: 3
    branch: export-screen/03-history-and-limits
    tasks: [7, 8]
    ships: "Recent exports on the screen, and a cap per organizer"
---

# Export screen plan

Build the [spec](spec.md) in three pull requests. PR 1 lays the groundwork
behind a flag, so nothing exports in the request (decision 0003). PR 2 runs
every export in the export worker and turns the screen on. PR 3 is polish
and a limit.

Each PR starts from `main` once the one before it has merged. Everything new
lives in the `exports` app; leave `events/` and the event reminder emails
alone, though the export worker shares their Redis.

::prs

::tasks

# PR 1: Foundation

The model, the writers and the screen, behind the `export_screen` flag.
The screen creates Queued rows but nothing builds them until PR 2, so
organizers do not see it yet.

### Task 1: The `Export` model

An `Export` row per request: which organizer, which type, the range, the status,
when it became Ready (`ready_at`), and later the file. Statuses as in the
[spec](spec.md#statuses).

Files: `exports/models.py`, a migration. Test: `exports/tests/test_models.py`,
that a new export is Queued and that `ready_at` is set only on Ready.

### Task 2: The export screen

The form from the [mockup](brainstorm.md#where-we-landed), behind the
organizer permission. Builds on Task 1.

Files: `exports/views.py`, `exports/templates/exports/screen.html`,
`exports/urls.py`. Test: `exports/tests/test_screen.py`, that a member without
the permission gets a 403 and that the form creates a Queued export.

### Task 3: One writer per type, CSV \| zip

`RsvpWriter` and `VenueWriter` write CSV rows for a date range;
`PhotoArchiveWriter` streams the photos of the events in the range into a
zip. Tasks 1 to 3 make up PR 1.

Files: `exports/writers.py`. Test: `exports/tests/test_writers.py`, the rows
of a two-event range and the names in a small archive.

# PR 2: Background jobs with `build_export`

Every export runs in the worker. This is the PR that closes the
[timeout risk](../../risks/export-timeouts.md).

### Task 4: Run exports in a Celery job

`build_export(export_id)` loads the row, runs the writer from Task 3 into a
temporary file, and moves the status from Queued to Building to Ready, or
Failed with the error.

Files: `exports/tasks.py`, the worker's queue in `foodieclub/celery.py`. Test:
`exports/tests/test_tasks.py`, run eagerly: a writer that raises leaves the row
Failed with its error.

### Task 5: Store the file with an expiring link

Upload to the private bucket under `exports/<id>.csv` or `.zip` and keep the key on
the row. Links last seven days ([Q1](../../handoffs/export-jobs.md#q1));
a nightly job deletes the file and marks the row Expired.

**Interfaces:**

- Consumes: the temporary file from Task 4.
- Produces: `Export.download_url(user)`, which returns `None` unless the
  export is Ready and `user` is the organizer who started it, and otherwise
  signs a link for five minutes.

- [ ] **Step 1: Write the failing test**

```python
from datetime import timedelta

from exports.tasks import expire_exports


def test_expired_export_has_no_download(export_factory, freezer):
    export = export_factory(status="ready")
    freezer.move_to(export.ready_at + timedelta(days=8))
    expire_exports()
    export.refresh_from_db()
    assert export.status == "expired"
    assert export.download_url(export.organizer) is None
```

- [ ] **Step 2: Run it to see it fail**

Run: `pytest exports/tests/test_expiry.py -v`
Expected: FAIL, `expire_exports` cannot be imported from `exports.tasks`.

- [ ] **Step 3: Add `expire_exports` and the nightly schedule**

- [ ] **Step 4: Run the whole exports suite, and commit**

Run: `pytest exports -v`
Expected: PASS

### Task 6: Email the link

Send "Your photos export is ready" with the link when the job finishes,
and "Your export failed" with a retry link when it does not. The retry link,
and `./manage.py export retry <id>` for whoever runs the server, queue a
Failed export again. Whether the screen also shows a notice is
[Q4](../../handoffs/export-jobs.md#q4). Needs Task 5's link.

Files: `exports/emails.py`, `exports/management/commands/export.py`. Test:
`exports/tests/test_emails.py`, both emails' text and links, and that `retry`
moves a Failed export back to Queued.

# PR 3: History and limits

### Task 7: Recent exports in a `<table>`

The last 20 exports for the signed-in organizer, newest first, with a Download
link while Ready.

Files: `exports/views.py`, `exports/templates/exports/screen.html`. Test:
`exports/tests/test_screen.py`, that another organizer's exports are not
listed and that only Ready rows have a link.

### Task 8: A cap per organizer

Refuse a new export over the hourly limit, with a message saying when the
next one is allowed. The number waits on Q3; the approach is decision 0004.

Files: `exports/limits.py`, `exports/views.py`. Test:
`exports/tests/test_limits.py`, that the export over the limit is refused with
the time of the next one allowed.

# Self-review notes

- Every task has its PR: Tasks 1 to 8.
- The tasks land in order. Task 6 emails the link Task 5 makes, and both need
  Task 4's job.
- One new process, the export worker on its own queue (decision 0003).
  Redis already runs for the event reminder emails.
