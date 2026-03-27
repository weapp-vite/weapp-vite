---
'@mpcore/simulator': patch
---

补充 `@mpcore/simulator` 的选择器查询回归覆盖，验证 `selectAll(...).fields(...)` 在页面与组件作用域下都能稳定返回数组结果，减少后续选择器行为回退风险。
