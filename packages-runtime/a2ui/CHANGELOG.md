# @wevu/a2ui

## 0.0.0

### Minor Changes

- feat(wevu-a2ui): 新增 A2UI 1.0 的 Wevu 渲染适配层，提供 surface 会话、视图投影、输入回写、catalog 函数扩展与动作外发。保留嵌套槽位节点，支持通过 bindingName/actionName 选择多个绑定或动作，失败的数据更新会回滚，异步动作与 Core 错误通过 onAction/onError 可靠传递；公开类型收敛为渲染所需契约，不再导出投影内部操作表类型。默认启用小程序安全的标准函数，支持 Checkable 校验结果投影，并在售后演示中展示与清除校验反馈。动作交互支持按 surface 隔离的 eventId 幂等去重，进行中动作共享执行，近期成功动作在限时限容窗口内去重，失败后允许重试。新增中文优先且不依赖 Intl 的数字、货币、日期与复数格式化，支持 zh-CN/en-US locale 与宿主覆盖；支持标准消息数组和 { messages } wrapper 的批量接收与单次视图提交，并按 sendDataModel 标准通过 onAction/onError 传递 a2uiRendererDataModel transport metadata 深拷贝快照。附带可运行的售后演示应用与真实 DevTools/headless runtime 验收。按 A2UI 1.0 收紧 catalog 版本并保留文档元数据，标准内置函数仅绑定到签名、调用方与激活约束兼容的声明，未实现函数保持 schema-only；同时修正大数四舍五入、负零、货币符号、空格与 ISO 默认精度。

- feat(skills): 为 `@wevu/json-render` 与 `@wevu/a2ui` 增加随 npm 包分发的实践 skills，分别覆盖 json-render 会话、SpecStream 与预编译组件接入，以及 A2UI 1.0 surface、投影交互与递归宿主；同步包构建、打包、共享分发清单、发布策略、触发回归清单和文档，`@wevu/json-render-components` 的使用指南归入 json-render 技能而不重复分发。现有技能 owner 与脚手架同步参与本次分发清单发布。

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：vite-plus, vitest。命名 catalog 变更键：tilde(vitest)。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, rolldown, tailwind-variants, vite, vue-router。命名 catalog 变更键：无。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.@vitest/browser
  - @weapp-vite/ast-native：devDependencies.vitest

- fix(a2ui): 修复严格 NodeNext 消费场景下公开类型解析失败的问题

- Updated dependencies:
  - @wevu/web-apis@1.5.5
  - wevu@7.13.0
