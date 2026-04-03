---
'@mpcore/simulator': patch
---

修复 `@mpcore/simulator` 中 `wx.pageScrollTo({ selector })` 被忽略的问题。现在 headless runtime 与 browser runtime 都会基于当前渲染树解析目标节点位置并同步 `scrollTop`，同时补充对应的单测、browser e2e 断言，以及 `mpcore/demos/web` 的 `commerce-shell` 场景验证入口。
