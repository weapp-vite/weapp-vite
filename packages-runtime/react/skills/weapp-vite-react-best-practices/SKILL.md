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

先确定只读诊断或实施范围，读取原生入口、TSX、既有模板/JSON、项目 scripts 与已安装包信息；记录 runtime/peers、实际构建工具、Node、包管理器以及目标微信 IDE、基础库和 renderer 的实际版本，未取得项明确缺失，不把依赖范围当安装版本。按任务选入口：
- root/事件/卸载：仅有 runtime 包也可从现有入口和产物诊断，见 `references/component-interop.md`；root 归页面/组件实例，检查同路由两次入栈、返回和 effect cleanup，不因诊断默认安装编译器。没有宿主时运行行为未验证。
- owner/render mode：需要 TSX 编译时先确认已安装 `weapp-vite`，进入 `references/config-and-render-modes.md`；缺构建器则停止编译步骤。检查目标 WXML/binding 与 root 模式匹配，非微信目标不推断兼容。
- bridge/Slot：带上真实 tag、JSON 路径、事件 payload 和所需依赖，进入 `references/component-interop.md`；遇到未注册、动态结构或缺依赖先修明确契约/列前提。检查注册产物，再在微信观察插槽和 `event.detail`。
- Compiler/回归：仅在本次显式启用 Compiler 且已有 `@swc/core` 时检查其 warning/sourcemap；沿 `references/validation-matrix.md` 运行项目已有检查，并另查 Hooks/视图。缺 scripts 或宿主就说明覆盖缺口，不把静态成功扩成 runtime 通过。

1. 检查项目实际安装的 `@weapp-vite/react` 版本及其 peer dependencies；React 19.3.x / `react-reconciler` 0.34.x 是当前文档的验证组合，不是任意版本的兼容承诺，不引入 `react-dom`。
2. 若使用 `weapp-vite` 编译，在项目级 `weapp.react` 启用 React owner；同一构建中的 `.jsx` / `.tsx` 全部归 React 编译链，不要与 Wevu JSX 混用。仅有 runtime 包时先沿用项目已有编译产物，不假定 `weapp.*` 可用。
3. 使用该编译链时从 `auto` 建立基线：稳定结构生成原生 WXML/binding slots，无法静态证明且不含 bridge 的结构进入 dynamic tree。
4. 页面原生入口负责按实例创建 root、转发宿主事件和卸载；React 视图放在相邻 TSX 模块，避免把 Page 生命周期藏进组件树。root 的 `'static-bindings' | 'tree'` 必须匹配现有模板/binding，不把构建配置的 `'auto' | 'static' | 'dynamic'` 直接传给 root。
5. 需要原生或 Wevu 自定义组件时，先在 JSON `usingComponents` 注册，再在当前 TSX 顶层用字符串字面量调用 `createNativeComponent`。
6. 需要 React-backed 小程序组件的默认插槽时使用 `Slot`；不要假设 scoped slot、model 或动态 tag 已受支持。
7. React Compiler 默认保持关闭；只有安装 `@swc/core` 并准备验证 fallback warning、sourcemap 和运行时行为时再启用。
8. 使用消费项目自己的 typecheck、相关测试和目标构建 scripts，再在目标微信 IDE/真机检查 Hooks、事件与卸载。没有脚本时先确认工具链与包管理器支持的调用方式；已安装 `weapp-vite` 的 pnpm 项目例如可用 `pnpm exec wv build -p weapp`，其他包管理器沿用项目方式。没有测试 script 就列缺口，不编造命令或运行框架仓库单测/E2E。
9. WebView glass-easel 默认保持关闭；仅在开发者工具与真机基础库均不低于 `3.8.12` 时由用户在宿主 JSON 中成对配置 `componentFramework` 与 `glassEaselWebview`。项目已安装 `weapp-vite` 时可再用 `wv analyze --glass-easel-check` 辅助检查 static/dynamic WXML 和 SelectorQuery；React 静态模板沿用标准 WXML 实体转义。

## 关键边界

- `renderMode: 'dynamic'` 用于排查 reconciler tree；它不支持原生组件 bridge。
- `renderMode: 'static'` 遇到无法静态证明的结构应直接失败，不能静默丢失语义。
- `auto` 中的 bridge 不得出现在条件、列表等动态结构中，也不支持跨文件 bridge 声明。
- `onValueChange` 映射为 `bind:value-change`，`onValueChangeCapture` 映射为 `capture-bind:value-change`。
- React 项目可显式安装 `wevu` 编译 `.vue`，但 TSX 仍归 React owner；互操作通过小程序自定义组件 bridge 完成。

## 输出

只输出本次相关的实际版本/微信平台边界、root/TSX 改动或只读诊断、render mode 或 bridge 契约，以及最小检查与剩余前提。未涉及 Compiler/bridge 时不强制展开；诊断建议不写成已实施修复。

每项结论用短记录关联：`对象/版本 → 实际命令或动作 → 观察/产物 → 方法、结果、限制`；同一结论可并列记录多种方法，各自结果互不覆盖，建议与已执行分开。缺前提仅阻塞依赖它的操作/验证，继续可达的只读诊断：
- 自动验证 `passed`：实际命令/断言通过，只覆盖检查到的类型、产物或运行行为。
- AI 评估 `passed`：写明评估者、判据和材料，不称自动验证；只有实际隔离过才可称独立。
- 人工确认 `passed`：引用对该具体结果及版本的确认，计划获批不等于结果/示例获批。
- 未验证 `not-run`：未执行或缺前提并说明原因；已执行失败按实际方法记 `failed` 并保留证据。构建、类型声明和 `setData` callback 不单独证明显示/Hooks/卸载正确；静态结构检查也不证明证据真实或任务执行。

## 完成标记

只判断本次涉及的依赖/owner、每实例 root 与事件卸载、bridge 注册及支持结构；无关项不适用。Compiler fallback、构建产物与微信 runtime 观察分别记录，失败或未验证项不算通过，不外推到其他平台。
- 反馈记录期望/实际、复现及依赖/宿主前提、证据与限定范围的提议；确定性 root/编译/事件错误优先进入工具或检查，语义/风格先作候选示例交人工审阅。一次偏好留本次记录；确有复发及具体人工规则决定后才提议长期规则，不自动改源码/全局规则或上传业务数据。
- Skill 永久修订只在获授权的作者检出目录进行，不编辑包管理器受管的安装副本（如 `node_modules` 内 Skill 或 `.agents/skills` 指向它的链接）；维护用例留在作者仓库，不随消费包提供，也不是使用前提。

## 参考资料

- 配置、render mode 与 Compiler：`references/config-and-render-modes.md`
- 原生/Wevu 互操作：`references/component-interop.md`
- 验证分层：`references/validation-matrix.md`
