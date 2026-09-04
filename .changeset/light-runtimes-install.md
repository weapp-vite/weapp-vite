---
"wevu": patch
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

重构 Wevu 可选运行时能力的安装边界：编译产物会按模板元数据和应用选项显式安装所需能力，未使用 patch、模板 ref、内联事件、高频告警、作用域插槽或 layout 的小程序不再携带对应实现；公开 `wevu` 入口继续保留原有动态配置行为。
