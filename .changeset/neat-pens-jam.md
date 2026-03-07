---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 在 alias 命中场景下补充 `resolve().matched` 语义：保持 `matched.path` 为 canonical 路由路径，并在叶子记录上新增可选 `aliasPath` 字段标记实际命中的 alias 模板/路径，便于调试与埋点时区分“规范路径”与“alias 命中路径”。
