---
'create-weapp-vite': patch
---

修复零售模板的 Volar 模板类型推断配置。`weapp-vite-wevu-tailwindcss-tdesign-retail-template` 不再禁用模板 codegen，这样 `<wxs src="./phoneReg.wxs" module="phoneReg" />` 这类 WXS 模块可以正确注入模板上下文，避免在编辑器中错误提示 `phoneReg` 不存在于组件实例类型上。
