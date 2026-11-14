---
kind: decision
number: "0003"
title: "0003. Build every export in a background job and email a link"
status: locked
proposed: 2026-10-24
date: 2026-10-27
supersedes:
  - decision: "0002"
ask: "I need every photo from 2026 for the December social, and neither of us should have to SSH in for it."
confirmed: "Sofia Bianchi, at the October planning call: \"Yes, all of them through the worker. One way to do it.\""
history:
  - date: 2026-10-27
    note: "Locked."
  - date: 2026-11-03
    note: "How long links last was settled as [Q1](../handoffs/export-jobs.md#q1): seven days."
---

# 0003. Build every export in a background job and email a link

## Context

Decision 0002 streamed exports in the request. A year of photos takes
about seven minutes and the platform stops requests at 30 seconds, so the
zip was cut off. The club app already runs a Celery worker for event
reminder emails.

## Decision

Starting an export creates an `Export` row and queues a job. The job writes
the file, stores it in the private bucket, and emails the organizer a link.
Every export type goes this way, including the quick ones.

![How an export runs](../images/architecture.svg)

## Consequences

- No export is bound by the request limit.
- RSVPs and photos are personal data, so exported files expire and are
  deleted; how soon was left open.
- The screen has to show each export's state: Queued, Building, Ready,
  Failed or Expired.
- A slow photo archive must not hold up reminder emails, so exports get a
  queue of their own and a worker process of their own: one new process,
  and the reason the "one worker" constraint in the context gives way.
