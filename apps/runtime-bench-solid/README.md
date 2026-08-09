# Solid-style JSX runtime POC

这个工程验证一种面向小程序的高性能 JSX 路线：JSX 在构建期编译为原生 WXML，运行时使用 Solid signals 追踪顶层 binding，并把同一微任务内的变更合并为一次 `setData`。

它不是通用 renderer，也不维护虚拟 Host Tree：

```text
TSX template -> Wevu JSX AST compiler -> native WXML
Solid signal -> binding effect -> microtask batch -> setData
```

## 当前覆盖

- 原生 WXML 列表和文本 binding
- 首屏、详情页和 100 卡片更新 benchmark
- 同步 signal 变更合并为一次 `setData`
- 页面卸载时释放 Solid owner 和 binding effects

## POC 边界

- template 标识符与 runtime binding 目前通过名称约定关联，编译器尚未生成或校验 binding metadata
- 尚未实现事件桥接、自定义组件、动态组件和无法静态化节点的 fallback
- compiler plugin 与 runtime 都是 benchmark 工程内部实现，不代表公开配置或包接口

## 验证

```bash
pnpm --filter runtime-bench-solid typecheck
pnpm --filter runtime-bench-solid build
pnpm --filter weapp-vite exec vitest run test/solid/poc.test.ts test/solid/runtime-bench.test.ts
```

真实微信开发者工具 benchmark 由仓库根目录执行：

```bash
pnpm e2e:runtime-bench
```
