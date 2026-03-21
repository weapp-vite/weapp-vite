---
'wevu': patch
'@weapp-vite/volar': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
'create-weapp-vite': patch
---

增强 `defineOptions` 的类型能力与 Volar 模板绑定识别：`wevu` 现在支持更完整的工厂签名与原生 `properties/data/methods` 类型推导，Volar 插件会把 `defineOptions` 中声明的模板绑定注入到模板类型检查上下文里。同时补齐 retail 模板中相关订单按钮组件的本地类型与交互缺陷，降低脚本侧类型噪音并修复遗漏的方法调用问题。
