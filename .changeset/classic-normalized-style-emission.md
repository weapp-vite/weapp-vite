---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic HMR 中规范化后的样式资源绕过去重、导致仅修改模板时重复输出无关 WXSS 的问题。统一在内存中完成资源规范化和缓存比对，再由打包器输出，保留真实样式更新和清空目录后的完整重建。
