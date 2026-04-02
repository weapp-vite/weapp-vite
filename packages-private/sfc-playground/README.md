# @weapp-vite/sfc-playground 使用指南

## 1. 简介

`@weapp-vite/sfc-playground` 是仓库内部使用的私有调试 playground，用来在浏览器里实时观察 wevu SFC 的编译结果。

它基于 `@vue/repl`，在常规 Vue 预览之外，额外展示：

- wevu script 产物
- wevu template 产物
- wevu style 产物
- wevu config 产物
- 编译 meta 信息与 warnings

这个包不会发布到 npm，主要服务于本仓库开发、排障和编译链调试。

## 2. 适用场景

- 调试 `@wevu/compiler` 的 SFC 编译结果
- 对比 Vue SFC 输入与 WXML / WXSS / JSON 输出
- 排查 `<json>` 块、模板语法、样式转换和 script 改写问题
- 在不启动完整小程序工程的前提下快速验证编译行为

## 3. 启动方式

在仓库根目录执行：

```bash
pnpm --filter @weapp-vite/sfc-playground dev
```

构建静态产物：

```bash
pnpm --filter @weapp-vite/sfc-playground build
```

## 4. 工作方式

playground 会读取当前编辑器中的 `.vue` 文件内容，并调用仓库内编译能力完成以下步骤：

1. 使用 `vue/compiler-sfc` 解析 SFC。
2. 将模板编译为 WXML。
3. 将样式编译为 WXSS。
4. 将脚本转换为 wevu 运行时可消费的代码。
5. 汇总 `<json>` 块、meta 与 warnings，在右侧输出面板中展示。

## 5. 注意事项

> **注意**：这是内部调试工具，不保证外部 API 稳定性。

> **注意**：它直接引用仓库内源码路径，因此更适合在 monorepo 根目录下联调，不适合作为独立包复用。

## 6. 相关链接

- `wevu`：[../../packages-runtime/wevu/README.md](../../packages-runtime/wevu/README.md)
- `@wevu/compiler`：[../../packages-runtime/wevu-compiler/README.md](../../packages-runtime/wevu-compiler/README.md)
- `weapp-vite`：[../../packages/weapp-vite/README.md](../../packages/weapp-vite/README.md)
