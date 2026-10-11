# @weapp-agent/cli

## 0.1.0

### Minor Changes

- feat(scaffold): 更新脚手架工具链选择与 Weapp Agent 工作流，并联动框架、Dashboard 和 IDE 验收使用契约。

  - 新增与业务模板独立的 `--toolchain=wv|vite|vite-plus`，生成共享配置、多平台及组件库脚本；保持 Vite+ 引擎 alias、配套 Vitest、严格 peer、依赖覆盖与 Node 要求一致，保留小程序命令、检查及受管类型流程。
  - 迁入独立 Weapp Agent CLI，兼容旧命令、配置和会话，生成统一验收指引；联动 Dashboard/Hub、品牌图标、受控调查及框架增量查询能力。
  - 长任务压缩保留完整用户要求，准确处理重复工具调用 ID 与中断结果；新增只读会话详情及交互确认恢复，上下文预算不足明确停止，避免重放操作。
  - 等待恢复确认期间保存追加要求和图片，确认后顺序交付；并发恢复仅允许一个 writer，关闭等待日志写完，避免覆盖其他会话锁或损坏记录顺序。

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

- Updated dependencies:
  - @weapp-vite/acceptance@0.1.0
  - @weapp-vite/mcp@2.0.0
  - weapp-ide-cli@6.2.0
