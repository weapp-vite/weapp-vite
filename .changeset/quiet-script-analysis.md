---
"weapp-vite": patch
"create-weapp-vite": patch
---

合并并复用入口加载器中的 Vue 模板标签与 script setup 导入分析，保留逐次外部依赖解析、组件注册和配置冲突检查；修复外部 template src 在没有内联组件标签时被提前跳过的问题。修复外部脚本或模板变化时的完整编译失效，并确保 HMR 新发现的组件与受影响入口一起由打包器发射模板和 JSON。
