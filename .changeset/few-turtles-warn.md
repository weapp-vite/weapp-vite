---
'create-weapp-vite': patch
---

修复零售模板的 Volar 模板类型推断配置。`weapp-vite-wevu-tailwindcss-tdesign-retail-template` 不再禁用模板 codegen，并为 `ui-address-item` 里的 `phoneReg` WXS 模块补充纯类型兜底声明；这样即使编辑器侧的 Volar WXS 注入未及时生效，也不会再错误提示 `phoneReg` 不存在于组件实例类型上。
