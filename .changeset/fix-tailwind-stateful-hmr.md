---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Tailwind 内容文件在配置变更、原生入口更新和状态化 HMR 快照之间的失效传播，确保后续脚本更新能刷新样式并保留页面运行状态。
