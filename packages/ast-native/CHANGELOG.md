# @weapp-vite/ast-native

## 0.0.2

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b) by @sonofmagic
  - 默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
  - 同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。

## 0.0.1

### Patch Changes

- 🐛 **新增可选的 native AST 批量分析与性能评估能力，将同一份脚本上的多项静态检查合并为一次 JS 与 Rust 通信和一次解析，并在 bundle rewrite 热路径复用分析缓存。native binding 未配置、加载失败或执行失败时继续回退 Babel、Oxc 与 Vue compiler 路径，保持现有构建兼容性。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic
