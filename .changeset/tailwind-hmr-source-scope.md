---
"@weapp-vite/tailwindcss": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Tailwind HMR 将自动扫描范围扩大到项目根目录的问题。初始来源登记、新增文件发现与内存批次编译统一沿用编译器解析出的样式来源范围，避免依赖目录使用符号链接时扫描大量无关文件，并保留显式来源配置。
