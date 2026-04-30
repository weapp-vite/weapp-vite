---
"@weapp-vite/dashboard": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 dashboard 分析视图：analyze payload 现在写入真实 gzip/brotli 体积，页面展示压缩后体积、上次结果对比、包体预算告警、treemap 点击联动、重复模块建议、来源细分以及摘要复制/JSON 导出，并补充更细的开发态与构建态运行事件。
