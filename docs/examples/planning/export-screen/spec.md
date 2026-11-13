---
kind: planning
type: spec
status: in-review
created: 2026-10-26
updated: 2026-11-05
note: "In review until Q2 and Q3 are answered."
issues:
  - ref: "foodie-club-app#12"
    title: "Export screen for organizers"
    note: "Umbrella issue"
related:
  - title: "Brainstorm"
    link: "brainstorm.md"
    note: "Why a background job"
  - title: "The handoff"
    link: "../../handoffs/export-jobs.md"
    note: "What the implementing session was given"
---

# Export screen spec

## Goal

An organizer picks what to export and a date range, presses Start export,
and gets an email with a download link when the file is ready. The screen
lists their recent exports and the state of each. It rests on decision
0003: every export runs in a background job.

## Non-goals

Scheduled exports, and formats beyond CSV and zip (decision 0001).

## The screen

Shown in the [brainstorm](brainstorm.md#where-we-landed). It has:

| Part | Behaviour |
|---|---|
| What to export | RSVPs (CSV), Venues (CSV) or Photos (zip). RSVPs for organizers only until Q2 is answered |
| From and To | Optional dates, inclusive, matched against the event's date. Empty means all time |
| Start export | Creates the export and returns at once; the row appears as Queued |
| Recent exports | The organizer's last 20: type, range, when, status, and a Download link once Ready |

## Statuses

| Status | Meaning |
|---|---|
| Queued | Created, waiting for the worker |
| Building | The worker is writing the file |
| Ready | The file is stored and the email sent |
| Failed | The job raised; the row says why, and the organizer can start it again |
| Expired | Seven days have passed; the file is deleted ([Q1](../../handoffs/export-jobs.md#q1), answered) |

## Limits

- A link works for seven days, then the file is deleted.
- An organizer can start a limited number of exports an hour; decision
  0004 proposes how to enforce it.
- The download checks the organizer is signed in; the link alone is not
  enough.

## Open questions

| | Question | Owner |
|---|---|---|
| [Q2](../../handoffs/export-jobs.md#q2) | Can welcome hosts export the RSVPs for the night they host? | Sofia Bianchi |
| [Q3](../../handoffs/export-jobs.md#q3) | How many exports may one organizer start in an hour? | Marcus Chen |
