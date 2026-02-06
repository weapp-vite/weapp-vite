---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复多平台（尤其支付宝）编译兼容与 `wpi` 注入问题。

- 模板转换增强：支付宝产物支持 `wx:* -> a:*`、`bind/catch` 事件映射到 `on*/catch*`，并将 PascalCase 组件标签与 `usingComponents` key 归一化为 kebab-case。
- JS 目标兼容增强：支付宝在未显式配置 `build.target` 时默认降级到 `es2015`，避免可选链等语法在开发者工具中报错。
- `injectWeapi` 注入增强：在显式开启 `replaceWx: true` 时，编译阶段自动把 `wx/my` API 调用重写为统一 `wpi` 访问，且运行时不再依赖 `globalThis`，兼容支付宝环境。
- 默认行为保持不变：`injectWeapi.replaceWx` 仍默认关闭，需要在项目中显式开启。
