---
kind: decision
number: "0004"
title: "0004. Limit how many exports an organizer starts an hour"
status: proposed
date: 2026-11-05
reason: "The spec left the limit open; in review of PR 2, repeated clicks queued six photo archives and made it urgent."
---

# 0004. Limit how many exports an organizer starts an hour

## Context

Since decision 0003 every export costs a job, a file and an email. In
review of PR 2 one organizer queued six identical photo archives, 2.9 GB
each, with repeated clicks on Start export while the page was slow. The
club pays for that storage out of a shoestring budget.

## Decision

Count the organizer's exports created in the last hour from the `Export`
table and refuse over the limit, saying when the next one is allowed. No
new counter store: the table already has the rows.

The number itself is open: [Q3](../handoffs/export-jobs.md#q3).

## Consequences

- Repeated clicks stop costing jobs and storage.
- An organizer preparing the year-end recap may hit the limit; the message
  has to say when they can try again.
- Built in :task[8]{topic=export-screen}.
