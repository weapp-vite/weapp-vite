# @weapp-vite/ast-native-linux-x64-gnu

## 0.3.1

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：vite-plus, vitest。命名 catalog 变更键：tilde(vitest)。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, rolldown, tailwind-variants, vite, vue-router。命名 catalog 变更键：无。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.@vitest/browser
  - @weapp-vite/ast-native：devDependencies.vitest

## 0.3.0

### Minor Changes

- feat(ast-native): 增加跨平台 native AST 预构建包。

  为 `@weapp-vite/ast-native` 增加 macOS、Linux GNU/glibc 和 Windows 六个目标平台的预构建发布包。根包会按运行时自动选择平台依赖，native AST 仍保持显式启用和失败回退行为。
