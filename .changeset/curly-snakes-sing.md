---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 组件模板 ref 在代理实例方法时丢失 `this` 的问题，使 layout 内通过 `useTemplateRef()` 获取到的 `t-toast`、`t-dialog` 宿主可以直接调用公开方法。同步简化 TDesign wevu 模板中的 layout 反馈宿主写法，默认改为使用语义化 bridge key 解析共享 toast/dialog，不再依赖 `#t-toast`、`#t-dialog` 这类基于 id 的选择器桥接。
