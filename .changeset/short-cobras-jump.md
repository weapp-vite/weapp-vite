---
'@wevu/api': patch
---

继续收敛 weapi 的多平台原始适配器类型入口，拆分平台语义名称与运行时别名名称，并补充对应的 raw adapter source registry 类型，减少新平台接入时继续围绕 `wx` / `my` / `tt` 混用命名。
