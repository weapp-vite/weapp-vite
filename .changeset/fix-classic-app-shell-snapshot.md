---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 classic 开发模式增删 App.vue 模板及外部模板内容切换时页面脚本未随应用壳一起重编译的问题，保证页面运行时能力、模板和组件配置在同一快照发布，并在发布失败后保留原有基线以便正确恢复。
