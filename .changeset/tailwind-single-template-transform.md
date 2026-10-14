---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: Tailwind HMR 的样式准备阶段只渲染最终会提交的样式资产，移除随后被丢弃的重复模板变换；模板继续由固定批次在实际快照上转换，保留输入隔离、类名转换与样式交付顺序。
