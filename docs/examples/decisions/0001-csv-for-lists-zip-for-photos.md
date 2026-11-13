---
kind: decision
number: "0001"
title: "0001. Lists export as CSV, photos as a zip"
status: locked
proposed: 2026-10-21
date: 2026-10-22
ask: "Can it just open in the sacred restaurant spreadsheet?"
confirmed: "Sofia Bianchi, in the organizer chat: \"CSV for lists, a zip for photos. Nobody needs a PDF of a pierogi.\""
---

# 0001. Lists export as CSV, photos as a zip

## Context

Organizers open lists in Google Sheets or Numbers, often on a phone at the
door. Photos go into the recap slideshow and the blog. Each extra format
(XLSX, JSON, PDF) is another writer to test per export type, and nobody
has asked for one by name.

## Decision

RSVPs and venues are UTF-8 CSV with a header row, dates in ISO 8601.
Photos are a zip of the original files, one folder per event, named by
the event's date and slug, such as `2026-07-28-pierogi-night/`.

## Consequences

- One writer per export type, not one per type and format.
- Excel on Windows needs the UTF-8 byte order mark to show names such as
  "Marisol" with accents intact; the CSV writers add it.
- A request for another format is a new decision, not a quick change.
