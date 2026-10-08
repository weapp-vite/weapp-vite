---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 HMR profile 分析器对非字符串枚举的校验，跳过畸形记录并保留后续合法样本，避免数组污染统计或对象导致分析中断。
