---
kind: planning
type: plan
split: true
status: approved
updated: 2026-11-11
stack:
  - "Astro"
  - "Starlight"
tasks:
  - { number: 1, status: done }
  - { number: 2, status: in-progress, issue: "#3" }
  - { number: 3, status: todo }
prs:
  - number: 1
    branch: export-screen/01-foundation
    tasks: [1, 2]
    status: in-review
  - number: 2
    branch: export-screen/02-history
    tasks: [3]
    ships: "A list of past exports"
---

# Export screen plan

::prs

::tasks

# PR 1: Foundation

### Task 1: The screen

Tasks 1 to 2 make up PR 1.

### Task 2: The download

Builds on Task 1. See [the history](#task-3-the-history) for what comes next.

**Interfaces:**

- Produces: `download(export_id)`.
- [ ] **Step 1: Write the failing test**

```python
def test_download_returns_the_file(): ...
```

- [ ] **Step 2: Run it to see it fail**

Run: `pytest tests/test_download.py -v`
Expected: FAIL

- [ ] **Step 3: Make it pass, and commit**

---

# PR 2: History

### Task 3: The history

A list of past exports, after Task 2.

# Self-review notes

Every task has its PR: Tasks 1 to 3.
