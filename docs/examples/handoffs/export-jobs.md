---
kind: handoff
title: Background export jobs
from: Planning session
to: Implementing session
date: 2026-11-03
status: picked-up
decisions: ["0001", "0003"]
inputs:
  - planning/export-screen/spec.md
  - planning/export-screen/plan.md
  - decisions/0003-build-exports-in-a-background-job.md
  - architecture.md
open_questions:
  - id: Q1
    question: How long should a download link keep working?
    blocks: Task 5
    owner: Sofia Bianchi
    answer: Seven days, then the file is deleted. Long enough to cover a weekend, short enough for RSVPs and photos of people.
  - id: Q2
    question: Can **welcome hosts** export the RSVPs for the night they host, or only organizers?
    blocks: A task in PR 3, if the answer is yes
    owner: Sofia Bianchi
  - id: Q3
    question: How many exports may one organizer start in an hour?
    blocks: Task 8
    owner: Marcus Chen
  - id: Q4
    question: Is the email enough, or should the screen also show a notice when an export is ready?
    blocks: Task 6
    owner: Marcus Chen
next_steps:
  - Read the spec, then the plan's PR 2
  - Finish Task 5 on the open pull request
  - Build Task 6, emailing only, unless Q4 is answered first
  - Stop before PR 3 and report back
---

# Background export jobs

## Summary

PR 1 is merged: organizers export RSVPs and venues from the screen, in the
request. This hands over PR 2, which moves every export into the worker so
the photo archive can run for a whole year (decision 0003). The first thing
to produce is Task 5 passing review.

## Context

The club app is Django with a Celery worker already running for event
reminder emails; see the [architecture](../architecture.md). Exports get a
queue of their own. Run the exports suite with `pytest exports -v`; it uses
a fake bucket, so no AWS credentials are needed.

Already checked: the private bucket exists and the worker's role can write
to `exports/` and read `photos/`. Signed links work from the staging site.

## What is decided

- CSV for lists, a zip for photos, decision 0001.
- Every export through the worker, decision 0003. The spec's
  [statuses](../planning/export-screen/spec.md#statuses) are the source of
  truth for the screen.
- Links last seven days ([Q1](#q1), answered).

## What is open

Q2 goes to Sofia and Q3 to Marcus; neither blocks PR 2. A yes to Q2 adds
a task to PR 3 for a host-only view of the screen. Q4 blocks
only the notice in Task 6: build the email and leave the notice out until
it is answered. Answers go into this page's front matter.

## First task

Get Task 5 through review: the test in its first step, the nightly
`expire_exports` job, and the five-minute signed link. Stop and ask if the
bucket's lifecycle rules look like a better fit than the nightly job.

## Files

| Path | What |
|---|---|
| `exports/models.py` | `Export`, from Task 1 |
| `exports/writers.py` | One writer per type, from Task 3 |
| `exports/tasks.py` | The job, from Task 4 |
| `exports/storage.py` | Upload and signed links, Task 5, on the open pull request |
