# @weapp-vite/ast-native-win32-x64-msvc

## 0.3.0

### Minor Changes

- feat(ast-native): 增加跨平台 native AST 预构建包。

  为 `@weapp-vite/ast-native` 增加 macOS、Linux GNU/glibc 和 Windows 六个目标平台的预构建发布包。根包会按运行时自动选择平台依赖，native AST 仍保持显式启用和失败回退行为。
