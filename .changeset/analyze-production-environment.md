---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 analyze 在配置加载前未初始化生产环境，导致报告保留真实生产构建已经裁剪的 HMR 代码、产物字节和内容哈希不一致的问题。分析与 build 使用相同的生产环境语义，保留自定义 mode。
