---
'@wevu/compiler': patch
'wevu': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `layout-host` 增加通用的编译期声明与运行时实例解析机制：layout 内组件可直接用 `layout-host="..."` 暴露宿主，`wevu` 会优先从运行时已解析的宿主实例读取能力，减少页面/组件侧对 `selector`、`id`、`useTemplateRef()` 和手动注册 bridge 的依赖。同步修复 `weapp-vite` 在 layout 构建时错误输出 scriptless stub 的问题，并更新 TDesign wevu 模板与 DevTools e2e，用例覆盖首页 toast、layout-feedback 页面 alert/confirm 以及无 `未找到组件` 警告的场景。
