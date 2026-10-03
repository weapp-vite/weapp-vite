# @weapp-agent/cli

## 0.1.0-preview.1

### Patch Changes

- 迁入独立 Weapp Agent CLI 并保留旧命令、配置和会话兼容，脚手架增加统一验收工作流指引

- 升级 Vite、Oxc、Devframe、Sass、环境变量展开、脚手架 npm 配置与 AI SDK 等生产依赖及构建工具链，并同步工作区锁文件。

  - 迁移 Rust Oxc 至 0.152 与 N-API 依赖，适配新版解析结果和箭头函数 AST，保持批量分析、嵌套函数边界与可选 native 回退契约。
  - 对齐 React reconciler 0.34 的宿主接口，补齐异步提交所需的 hook，修复 `startTransition` 提交时因缺失宿主方法而失败的问题。
  - 升级 uview-plus 至 3.8.127，新增 `u-flex` / `up-flex` 自动导入及组件交互场景，将兼容矩阵扩展至 138 个具名组件，并保留条码组件读取 canvas 引用前等待实例 `$nextTick()` 的补丁。
  - 同步 `create-weapp-vite` 模板 catalog、React 模板的 SWC 依赖与生成的 AI 指引，使新建项目和 React 19.3 / reconciler 0.34 验证基线保持一致。

- Updated dependencies:
  - @weapp-vite/acceptance@0.1.0
  - @weapp-vite/mcp@2.0.0
  - weapp-ide-cli@6.2.0
