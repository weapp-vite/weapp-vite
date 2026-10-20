---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Vue SFC 引用共享原生模板时的 JSON 冷暖不一致，等待模板依赖扫描、登记传递失效关系，并由 Vue 编译器统一发布当前组件与布局配置，避免热更新丢失布局或保留已移除的自动组件。

外部模板中的原生 import/include/WXS 保持相对真实模板源文件定位，编译器生成的样式辅助 WXS 保留其输出目录归属。
