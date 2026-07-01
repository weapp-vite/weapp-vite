---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化增量 HMR 的 WXML 输出目标解析：当 renderStart 已给出明确 targetIds 时，直接按目标读取 token，不再扫描整个 WXML tokenMap，减少大项目模板/样式/JSON 变更时的 renderStart 开销。
