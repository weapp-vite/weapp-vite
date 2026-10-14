---
"@weapp-vite/tailwindcss": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Tailwind HMR 来源匹配在同一文件判断中反复解析相同目录并重复编译 glob 的开销。每个文件重新读取条目字段和真实路径，仅在本次判断内复用目录解析，并在批次内延迟复用纯 glob 编译结果；保留上游候选范围、隐藏文件、错误短路和回调后符号链接变化的行为。
