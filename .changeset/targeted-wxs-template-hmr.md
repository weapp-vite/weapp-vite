---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化增量 HMR 的 WXS 输出扫描：模板类文件变更时优先只读取当前变更模板的 token，不再默认遍历整个 WXML tokenMap；WXS 文件自身和依赖 importee 变更仍保留全量扫描以正确找到引用者。
