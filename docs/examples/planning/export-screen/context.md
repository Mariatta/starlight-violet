---
kind: planning
type: context
status: done
created: 2026-10-20
updated: 2026-10-20
note: "A snapshot: the figures are from the week of 2026-10-13."
related:
  - title: "Architecture"
    link: "../../architecture.md"
    note: "How the club app is put together today"
---

# Export screen context

The Lucky Town Foodie Club runs on a small Django app: members, events,
RSVPs, the venue list and the photos from every cooking night and crawl.
Organizers ask for spreadsheets every week, and today one of them gets each
by running a management command on the server. This page is what was true
before the export screen was designed.

## How exports work today

Marcus runs `manage.py export rsvps --event pierogi-night`, waits, and
copies the CSV off the server to the welcome host's laptop. He and Sofia
are the only two with shell access; everyone else asks in the organizer
chat.

## Exports in one week

| Export | Runs per week | Typical size | Slowest run (seconds) |
|---|---:|---:|---:|
| RSVPs | 9 | 36 rows | 3 |
| Venues | 2 | 61 rows | 2 |
| Photos | 1 | 1,840 photos, 2.9 GB | 412 |

Photos is the export that would time out behind a web request: the
platform cuts requests off at 30 seconds. That is the
[risk](../../risks/export-timeouts.md) this work has to answer.

## What people asked for

- Welcome hosts: the RSVP list for tonight, on their phone, without asking
  Marcus.
- Sofia: every photo from the year in one download, for the recap
  slideshow at the December social.
- Marcus: the venue list as a spreadsheet he can sort, so it stops being
  "the sacred restaurant spreadsheet" that only lives on his laptop.
- Who besides organizers may see RSVPs, which hold names and emails, was
  still open at handoff: see [question Q2](../../handoffs/export-jobs.md#q2).

## Constraints

- One web process and one worker on the current plan; no new services
  unless a decision says so. The club runs on a shoestring.
- RSVPs and photos are personal data, so exported files cannot sit in a
  public bucket or live forever.
