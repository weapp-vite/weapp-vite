---
"weapp-vite": patch
---

修复 `weapp-vite prepare` 在部分 Wevu / issue 工程中会额外预加载应用入口，导致 `pnpm install` 的 workspace `postinstall` 偶发不退出并看起来卡在 `website postinstall` 的问题。
