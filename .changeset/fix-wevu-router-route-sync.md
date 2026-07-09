---
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu router 成功导航后 `currentRoute` 未及时同步的问题，确保后续 `beforeEach` / `afterEach` 能拿到正确的 `from`，并让原生 `switchTab` 成功后同步 `useRoute()` 状态。
