---
kind: risk
status: open
likelihood: high
owner: Sofia Bianchi
created: 2026-10-20
updated: 2026-11-12
note: "Mitigated once PR 2 merges."
related:
  - "[Export screen plan](../planning/export-screen/plan.md)"
  - title: "Decision 0003"
    link: "../decisions/0003-build-exports-in-a-background-job.md"
    note: "The mitigation"
---

# Large exports time out

## Impact

A photo archive of a year takes about seven minutes; the platform stops a
request at 30 seconds. Streamed in the request, the browser saves a zip
that will not open, with no error
([what the spike found](../planning/export-screen/brainstorm.md#what-we-tried-first)).
The recap slideshow at the December social would be missing the pierogi
night, the dessert crawl and the poutine cook-off.

## Mitigation

Build every export in the background and email a link (decision 0003).
:task[4]{topic=export-screen} moves the writers into a job and
[Task 5](../planning/export-screen/plan.md#task-5-store-the-file-with-an-expiring-link)
stores the file; both ship in :pr[2]{topic=export-screen}.

What still waits on an answer, from the handoff:

::questions{of=export-jobs}
