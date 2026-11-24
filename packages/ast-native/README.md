# @weapp-vite/ast-native

weapp-vite Rust/Oxc native AST analysis

提供 macOS arm64/x64、Linux arm64/x64 GNU/glibc 和 Windows arm64/x64 MSVC 预构建平台包。Linux musl 与其他架构暂不提供原生包。

安装根包会自动选择当前平台的可选依赖。native AST 仍需显式设置 `WEAPP_VITE_NATIVE=1` 并配置现有 `WEAPP_VITE_NATIVE_AST_PATH`，未启用时不会加载原生模块。

## 安装

```bash
pnpm add @weapp-vite/ast-native
```

## 使用

请根据包导出的 API 和仓库中的示例使用本包。完整文档与源码位于 [weapp-vite](https://github.com/weapp-vite/weapp-vite)。
