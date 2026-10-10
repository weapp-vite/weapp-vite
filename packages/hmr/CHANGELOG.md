# @weapp-vite/hmr

## 0.2.1

### Patch Changes

- fix(hmr): 完善微信 stateful HMR 的批次发布、会话交接和关闭边界，避免连续更新丢失确认、误删产物或意外重置页面状态。

  - 开发构建启动前设置正确 ESM 图格式；完整构建回调仅含变化文件时仍保留全部输出归属。独立分包样式由所属子构建发布，避免同名资产冲突。
  - CSS Modules 的类名脚本与样式同批交付，维持稳定样式 factory 身份，保证后续脚本更新、完整构建或编译错误恢复后的补丁可用。
  - 原生脚本恢复到已完整发布基线后，纯样式编辑继续增量更新；基线仅在原生产物成功写出后推进，未知输入、写出失败与并发修改仍触发完整发布保护。
  - 页面、组件及 worker 拓扑变化重建正确入口，清理失效产物；删除页面后不再让旧引擎读取已删除侧车。完整快照只向替换会话交接一次，并核对源码与声明依赖版本，覆盖不足或输入变化时重新构建。
  - 宿主重启按独立上下文串行交接，兼容配置重载与强制重启；快照失败后新增文件可唤醒修复，初始化失败或关闭可取消等待并回收自有引擎。
  - 保留提前到达的客户端执行确认及客户端会话切换后的交付；接受批次时立即释放旧看门狗，同时保留未交付批次、重注册和更新失败的恢复机制。
  - 交付队列提供可等待稳定边界，覆盖快照重建与产物发布；失败明确拒绝等待，修复后可等待后续成功交付，不以页面已更新替代后台发布完成。
  - 恢复静态资源监听规则，使图片更新不触发 IDE 页面重建；会话关闭、启动失败和服务器退出恢复临时项目配置，保留借用宿主的所有权。
  - Node IPC 父进程断开时执行正常清理。退出先停止交付并取消未确认传输，再等待启动、重启、watcher、provider、Dashboard/MCP 和日志桥结束，保留清理失败且不将正常退出误报为构建失败。

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

## 0.2.0

### Minor Changes

- 提供实验性的 HMR 批次协作内核与 Tailwind 编译控制器，供小程序构建宿主复用。保留宿主自身的监听、模块图、原生写出和运行时确认协议；weapp-vite 的现有 HMR、tailwindcss 配置与 prepareHmr 类型保持兼容。

  模拟器销毁运行时后取消延迟 Promise 回调新提交的计时任务，避免 React/Taro 卸载期间产生跨会话异步异常；外部页面和节点句柄仍严格失效。

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
  - @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
  - weapp-ide-cli：dependencies.@modelcontextprotocol/server
  - weapp-vite：dependencies.@weapp-tailwindcss/engine
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板
