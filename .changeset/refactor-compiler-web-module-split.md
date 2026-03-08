---
'@wevu/compiler': patch
'@weapp-vite/web': patch
---

汇总 `c8f491b328e2151eb8b8d284a1fac0974de09476` 与 `4ba41941f18028bedbb4b8d75426780b442d95c6` 两个重构提交。

## 变更摘要
1. `c8f491b328e2151eb8b8d284a1fac0974de09476`：重构 `@wevu/compiler`，将过长源码拆分为职责更聚焦的模块（覆盖 JSX 编译流程、`vueSfc` block src 解析、template 元素辅助逻辑、class/style computed 构建、`defineOptions` 序列化等），降低单文件复杂度并提升维护性。该提交以代码组织优化为主，不改变既有编译语义。
2. `4ba41941f18028bedbb4b8d75426780b442d95c6`：重构 `@weapp-vite/web` 运行时，拆分 `element`、`mediaApi`、`network`、`selectorQuery` 等超长模块为独立子模块（如 `mediaApi/*`、`network/*`），并抽离配套类型定义，增强边界清晰度与后续可扩展性。该提交同样以结构重排为主，不引入对外行为变更。
