---
"@weapp-vite/tailwindcss": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 合并连续且语义等价的 Tailwind 来源负规则，减少首次 HMR 准备中重复的目录解析，保留上游匹配、复杂模式、输入封存和依赖验证。
