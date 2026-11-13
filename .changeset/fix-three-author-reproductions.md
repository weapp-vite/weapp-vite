---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"weapp-vite": patch
"wevu": patch
"@mpcore/simulator": patch
"create-weapp-vite": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
---

fix: 修复嵌套文本格式化引入可见空白、setup 初值到达前创建子组件产生属性类型警告，以及外部 script setup 导入组件时路径解析错误的问题。同步 headless 的 String 空属性警告，并补充作者原始复现的真实 DevTools 与 headless 回归验证。
