---
"rolldown-require": patch
---

Fix bundle loading cache flow by validating in-memory meta, guarding cache writes when require fails, and keeping memory entries in sync with on-disk metadata to avoid stale hits.
