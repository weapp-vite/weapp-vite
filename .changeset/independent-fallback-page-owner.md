---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(build): 修复独立分包构建误收集主包 Vue 页面附属资源的问题，避免 classic 回退后发布没有脚本和组件依赖的孤立页面；保留主包普通分包页面，并修正 Vue、TSX、JSX 后备页面发现时重复截断文件名的问题。
