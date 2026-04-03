---
'@mpcore/simulator': patch
---

增强 `@mpcore/simulator` 的选择器相关行为。现在 headless runtime 与 browser runtime 都支持根据当前渲染树处理 `wx.pageScrollTo({ selector })`，`createSelectorQuery` 可匹配 `tag/id/class/data-*` 组合形式的简单复合选择器，页面/组件实例上的 `selectComponent` 与 `selectAllComponents` 也支持同类复合选择器。与此同时补充对应单测、browser e2e 断言，以及 `mpcore/demos/web` 中 `commerce-shell` 与 `component-lab` 场景的验证入口。
