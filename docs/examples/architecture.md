---
kind: reference
status: in-progress
created: 2026-10-20
updated: 2026-11-12
note: "Describes the club app as it will be once PR 2 of the export screen merges."
issues:
  - ref: "foodie-club-app#12"
    title: "Export screen for organizers"
related:
  - title: "Export screen plan"
    link: "planning/export-screen/plan.md"
    note: "The work that changed this page last"
  - title: "Large exports time out"
    link: "risks/export-timeouts.md"
---

# Architecture

The Lucky Town Foodie Club app is a Django app with a Celery worker. This
page covers the parts the export screen touches; as decision 0003 says,
once PR 2 merges, exports never run in the request.

![How an export runs: the organizer starts it, the web app queues it, the worker reads Postgres and the photos, uploads to S3, and the organizer gets an email with a link](images/architecture.svg)

## Parts

| Part | Runs | Holds |
|---|---|---|
| Web app | Django, one process | The export screen and the `Export` rows |
| Job queue | Redis | Queues `default` (event reminders) and `exports` |
| Worker | Celery, one process on `-Q default,exports` | Nothing; writes exports to a temporary file |
| Postgres | Managed database | Members, events, RSVPs, venues |
| Storage | S3, private bucket | `photos/` from every event, and `exports/<id>.csv` or `.zip`, deleted after seven days ([Q1](handoffs/export-jobs.md#q1)) |

## How an export runs

1. The organizer starts an export on the screen; an `Export` row is
   created as Queued.
2. The web app queues `build_export` on the `exports` queue and returns.
3. The worker picks it up, marks it Building, and runs the writer for its
   type.
4. The writer reads rows from Postgres for the date range, and for photos,
   the files under `photos/`.
5. The file goes to the bucket and the row becomes Ready.
6. The organizer gets an email with a link. The link checks they are
   signed in before it signs a five-minute download.

## Re-running a failed export

:::steps
1. Find the export and its error:

   ```sh
   ./manage.py shell -c "from exports.models import Export; print(Export.objects.filter(status='failed').values('id', 'error')[:10])"
   ```

2. Fix the cause. A `StorageError` is usually expired worker credentials;
   check the worker's role first.

3. Queue it again:

   ```sh
   ./manage.py export retry <id>
   ```

4. Watch it finish on the export screen, or with
   `celery -A foodieclub inspect active`.
:::

## Pages

::planning
