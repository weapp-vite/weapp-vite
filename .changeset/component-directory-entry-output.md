---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复目录形式的全局组件声明在解析到 index 入口后，脚本产物仍沿用目录别名的问题；组件脚本与模板、配置、样式使用同一物理输出路径，并合并指向相同入口的目录与显式 index 声明。
