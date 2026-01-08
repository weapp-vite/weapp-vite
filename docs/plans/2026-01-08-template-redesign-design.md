---
title: "weapp-vite-wevu-tailwindcss-tdesign-template Redesign"
date: "2026-01-08"
status: "approved"
---

# Overview

Redesign the template app into a scenario-driven mini program that highlights
wevu + weapp-vite + TDesign together. Replace the single HelloWorld demo with
multiple feature-focused pages and reusable components. Keep the UI coherent
with the TDesign brand tone and Tailwind utility baseline already in place.

# Goals

- Provide a production-like experience across multiple pages and subpackages.
- Demonstrate wevu Composition API patterns (ref/computed/watch).
- Showcase weapp-vite features (subpackages, alias usage, page JSON).
- Highlight TDesign components through real tasks, not isolated demos.

# Information Architecture

Main TabBar pages:

- 首页: hero + quick actions + KPI preview
- 数据: dashboard with KPIs, trends, comparisons
- 表单: multi-step form, upload, linked fields
- 清单: filters + list + details + empty/skeleton
- 能力: mini program API entries + links to subpackage labs

Subpackages:

- lab: component lab (TDesign coverage with short use cases)
- ability: API demos (scan, location, share, subscribe, clipboard)

# Component Plan

Shared components (no HelloWorld):

- KpiBoard: KPI grid with slot-based card content
- QuickActionGrid: icon + label + status chips
- TrendCard: trend summary with delta, badge
- FilterBar: tag filters + search input
- EmptyState: unified empty/placeholder display
- FormStep: step sections with validation hints
- ResultCard: summary after form submission

# Data Flow & State

- Page-level state via ref/computed.
- watch used for: filter changes, form field linkage, summary refresh.
- Mock data lives in each page or a small data module in `src/data/`.
- Subpackage pages load their own data to emphasize lazy loading.

# weapp-vite & TDesign Coverage

- definePageJson and defineComponentJson used on each page/component.
- styleIsolation set to apply-shared on shared components.
- TDesign used for form controls, list items, toast/dialog, and tabs.
- Showcase alias `@/` import paths across pages/components.

# Risks & Mitigation

- Visual overload: keep each page focused with 2-3 key sections.
- Complexity creep: limit components to core scenes; avoid full docs site.

# Out of Scope

- Full backend integration.
- Global state management beyond page-local state.
