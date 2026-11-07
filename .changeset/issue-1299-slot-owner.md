---
"@weapp-core/constants": patch
"@weapp-core/api": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复启用原生插槽上下文时，应用外壳和无脚本 Vue 布局的模板事件缺少对应组件处理方法的问题，并补齐 owner 所需运行时能力及构建重建支持。

移除 API 映射中结果相同的冗余名单查询，让诊断专用数据可从运行时裁剪，保留原有跨平台映射、adapter 和诊断行为。
