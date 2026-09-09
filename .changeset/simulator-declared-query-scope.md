---
"@mpcore/simulator": patch
---

修复 headless 页面和原生节点查询跨入子组件内部的问题，按节点声明作用域对齐微信开发者工具的普通插槽与 generic 插槽查询边界。

对齐真实 IDE 的组件属性初始化与 observer 顺序：created 阶段保留默认值，初始属性整体注入后先运行数据 observer、再按声明顺序运行属性 observer，兄弟组件完成初始化后统一 attached，避免 scoped slot 的派生数据缺失。
