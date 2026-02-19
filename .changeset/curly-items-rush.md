---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复分包之间共享 chunk 的跨包引用问题：当分包 `common.js` 被其他分包引用时，构建阶段会在目标分包生成本地副本并重写 `rolldown-runtime.js` 与其他静态依赖路径，避免微信开发者工具运行时报出 `module is not defined`。

同时补充 `tdesign-miniprogram-starter-retail` 全页面可访问的 IDE E2E 用例，并增强分类侧栏组件在子组件解绑场景下的方法调用容错，确保默认配置下页面访问更稳定。
