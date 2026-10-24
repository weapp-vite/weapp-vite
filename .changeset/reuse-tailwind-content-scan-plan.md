---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 在同一开发会话内复用未变化的 Tailwind 内容扫描规则，避免普通脚本和模板更新反复执行配置及图标插件；配置、样式及其依赖变化仍重新解析，候选与最终样式每次按当前源码生成。
