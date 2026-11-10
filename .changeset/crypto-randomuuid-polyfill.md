---
"@wevu/web-apis": minor
---

feat(web-apis): add crypto.randomUUID() polyfill

Generates RFC 4122 v4 UUIDs based on the existing `getRandomValues` fallback (host `wx.getRandomValues` → native `crypto` → `Math.random`), injected into the global `crypto` only when the host runtime lacks the API. Adds unit assertions and issue-448 e2e fixture coverage.
