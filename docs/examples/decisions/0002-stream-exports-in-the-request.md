---
kind: decision
number: "0002"
title: "0002. Stream exports in the request"
status: superseded
proposed: 2026-10-22
date: 2026-10-27
superseded_by:
  - decision: "0003"
reason: "The simplest thing that could work, before the spike."
history:
  - date: 2026-10-27
    note: "Locked: RSVPs and venues finish well inside the limit."
  - date: 2026-10-27
    note: "Superseded by decision 0003 after the photos spike was cut off at 30 seconds."
---

# 0002. Stream exports in the request

## Context

The export screen needs to return a file. The club app already runs a web
process; streaming the file from the view needs nothing new.

## Decision

The view streams the file with a `StreamingHttpResponse`, writing rows,
or photos into the zip, as they come.

## Consequences

- No worker, storage or email.
- Bound by the platform's 30-second request limit. The
  [brainstorm](../planning/export-screen/brainstorm.md#what-we-tried-first)
  records what happened to photos: a broken zip and no error.
