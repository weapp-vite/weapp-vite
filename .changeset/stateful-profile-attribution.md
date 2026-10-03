---
"weapp-vite": patch
"create-weapp-vite": patch
---

为状态保持 HMR 补充实际源事件、准备、提交等待、提交与发布阶段的 JSONL profile，区分两条构建管线的计时边界；分析结果保留无法归因的时间，不将嵌套阶段重复累加或把未完成批次计入成功耗时。
