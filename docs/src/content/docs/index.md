---
title: Violet
description: A Starlight plugin for architecture notes, plans and decisions that live beside the code
template: splash
hero:
  tagline: A Starlight plugin for the notes that live beside your code. Plans, decisions, runbooks and handoffs are read in place from your repo, checked against their front matter at build time, and laid out by what kind of page they are.
  image:
    file: ../../assets/violet.svg
  actions:
    - text: Get started
      link: /starlight-violet/getting-started/
      icon: right-arrow
    - text: Why Violet
      link: /starlight-violet/why-violet/
      variant: secondary
    - text: See the examples
      link: /starlight-violet/examples/
      variant: minimal
---

<div class="notes-cards not-content">
<a class="notes-card" href="kinds/"><span class="notes-card-title">Page kinds</span><span class="notes-card-description">A plan, a reference page, a decision and a handoff each have a job, a schema and a layout. Add kinds of your own.</span></a>
<a class="notes-card" href="front-matter/"><span class="notes-card-title">Front matter as data</span><span class="notes-card-description">Status, dates, issues and related pages are fields the build checks, and the page header shows them as badges and tables.</span></a>
<a class="notes-card" href="guide/kinds/planning/"><span class="notes-card-title">Plans with tasks and PRs</span><span class="notes-card-description">A plan lists its tasks and pull requests in front matter. Link to them by number from any page, and split a long plan into a page per PR.</span></a>
<a class="notes-card" href="guide/shortcodes/"><span class="notes-card-title">Shortcodes</span><span class="notes-card-description">One line such as ::planning or ::decisions becomes a table built from the notes, so an index never goes stale.</span></a>
<a class="notes-card" href="guide/writing/"><span class="notes-card-title">A writing guide for agents</span><span class="notes-card-description">The guide ships in the package. Point your coding agent at it and its notes come out in the shape the site expects.</span></a>
<a class="notes-card" href="guide/extending/"><span class="notes-card-title">Extending</span><span class="notes-card-description">Define your own kinds, add Markdown plugins, generate pages, and keep the rest of Starlight as it is.</span></a>
</div>
