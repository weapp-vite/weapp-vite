---
name: weapp-vite-react-best-practices
description: 面向使用 `weapp-vite` 与 `@weapp-vite/react` 开发 React 19 微信小程序的实践手册。适用于配置 `weapp.react`、编写 JSX/TSX 页面、选择 static/dynamic render mode、接入可选 React Compiler、管理 `createReactMiniProgramRoot` 生命周期，以及通过 `createNativeComponent` / `Slot` 与原生或 Wevu 组件互操作。
---

# weapp-vite React Best Practices

## 用途

在微信小程序中建立可预测的 React 19 编译、渲染和组件互操作边界，并用真实构建与 runtime 信号验证结果。

## 包与资料边界

- 本 skill 随 `@weapp-vite/react` 提供，负责 React runtime、root 生命周期和原生组件 bridge；本文 `references/` 均相对本 skill，不要求框架源码、仓库 E2E 或其他 skill。
- 先确认项目满足所安装 `@weapp-vite/react` 的 peer dependencies：`react`、`react-reconciler`、`miniprogram-api-typings`。这些是运行时/类型契约，不代表构建器已经安装；不使用 `react-dom`。
- `weapp.react`、render mode 选择、TSX 转换和 WXML 生成属于 `weapp-vite`；只有需要该编译工作流时才显式安装 `weapp-vite`。单独安装 `@weapp-vite/react` 不提供 `wv` CLI 或 SFC 编译器。
- Wevu SFC 互操作还需显式安装 `wevu`；React Compiler 还需可选 `@swc/core`。不为仅排查 React root/事件的任务默认添加这些包。
- 独立消费者先读本 skill references、已安装包的公开类型与 README；完整接入可查 [React 小程序接入](https://vite.weapp.dev/integration/react)，构建配置可查 [React 配置](https://vite.weapp.dev/config/react)。其他 skill 仅在已安装时可选。

## 不适用场景

- 通用构建、分包、多平台或 CLI：使用 `weapp-vite-best-practices`。
- Wevu JSX/TSX 或 Vue SFC：分别使用 `wevu-best-practices`、`weapp-vite-vue-sfc-best-practices`。
- 原生项目向 Wevu/Vue SFC 渐进迁移：使用 `native-to-weapp-vite-wevu-migration`。
- 支付宝、抖音等非微信目标：当前 React runtime 尚未提供兼容承诺。

## 核心流程

1. 检查项目实际安装的 `@weapp-vite/react` 版本及其 peer dependencies；React 19.3.x / `react-reconciler` 0.34.x 是当前文档的验证组合，不是任意版本的兼容承诺，不引入 `react-dom`。
2. 若使用 `weapp-vite` 编译，在项目级 `weapp.react` 启用 React owner；同一构建中的 `.jsx` / `.tsx` 全部归 React 编译链，不要与 Wevu JSX 混用。仅有 runtime 包时先沿用项目已有编译产物，不假定 `weapp.*` 可用。
3. 使用该编译链时从 `auto` 建立基线：稳定结构生成原生 WXML/binding slots，无法静态证明且不含 bridge 的结构进入 dynamic tree。
4. 页面原生入口负责创建 root、转发宿主事件和卸载；React 视图放在相邻 TSX 模块，避免把 Page 生命周期藏进组件树。
5. 需要原生或 Wevu 自定义组件时，先在 JSON `usingComponents` 注册，再在当前 TSX 顶层用字符串字面量调用 `createNativeComponent`。
6. 需要 React-backed 小程序组件的默认插槽时使用 `Slot`；不要假设 scoped slot、model 或动态 tag 已受支持。
7. React Compiler 默认保持关闭；只有安装 `@swc/core` 并准备验证 fallback warning、sourcemap 和运行时行为时再启用。
8. 使用消费项目自己的 typecheck、相关测试和目标构建 scripts，再在目标微信 IDE/真机检查 Hooks、事件与卸载。没有脚本时先确认工具链；仅已安装 `weapp-vite` 的项目可用 `pnpm exec wv build -p weapp`，不运行框架仓库单测或 E2E。
9. WebView glass-easel 默认保持关闭；仅在开发者工具与真机基础库均不低于 `3.8.12` 时由用户在宿主 JSON 中成对配置 `componentFramework` 与 `glassEaselWebview`。项目已安装 `weapp-vite` 时可再用 `wv analyze --glass-easel-check` 辅助检查 static/dynamic WXML 和 SelectorQuery；React 静态模板沿用标准 WXML 实体转义。

## 关键边界

- `renderMode: 'dynamic'` 用于排查 reconciler tree；它不支持原生组件 bridge。
- `renderMode: 'static'` 遇到无法静态证明的结构应直接失败，不能静默丢失语义。
- `auto` 中的 bridge 不得出现在条件、列表等动态结构中，也不支持跨文件 bridge 声明。
- `onValueChange` 映射为 `bind:value-change`，`onValueChangeCapture` 映射为 `capture-bind:value-change`。
- React 项目可显式安装 `wevu` 编译 `.vue`，但 TSX 仍归 React owner；互操作通过小程序自定义组件 bridge 完成。

## 输出

应用本 skill 时，输出必须包含：

- React owner、render mode 与平台边界诊断。
- 页面 root 生命周期与 TSX 文件级改动建议。
- 原生/Wevu bridge 注册和事件契约检查。
- 最小验证命令与需要真实 DevTools 覆盖的行为。

## 完成标记

- React 依赖组合和 `weapp.react` 配置明确。
- root 在页面卸载时正确 unmount，宿主事件可转发。
- bridge tag 与 `usingComponents` 一致，未使用当前不支持的动态结构。
- Compiler fallback、构建产物和真实 runtime 信号已经区分验证。

## 参考资料

- 配置、render mode 与 Compiler：`references/config-and-render-modes.md`
- 原生/Wevu 互操作：`references/component-interop.md`
- 验证分层：`references/validation-matrix.md`
