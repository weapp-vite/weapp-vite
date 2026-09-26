# #1081 编译批次交付实施记录

## 状态

**实现草稿，未完成最终验收。** 改动位于隔离分支 `codex/issue-1081-batch-hmr`。不能将 issue 标记为已修复，也不能将这份记录当作合并通过证明。

## 已落地的边界

- DevEngine 回调整批进入交付队列，固定源码版本，保持 Patch 顺序和元数据。
- DevEngine 独占插件 watchChange，关闭重复的 Vite 浏览器 HMR 失效；目录身份过滤原子保存的重复元数据事件。
- compiler provider 通过 `prepareHmr` 返回固定状态的样式、模板/脚本转换及释放方法；编译状态与资产提交、客户端执行状态分离。
- 样式仍由 Vite emit/write 持久化；失败不推进提交基线，未变化样式不重复写入。静态资源和二进制资产保留原 owner。
- 客户端执行回报后才调用 `notifyPayloadDelivered`；初始模块执行、重复回报、旧版本请求、失败重试和待交付容量分别处理。
- 原生输入、模板快照与外部 SFC block 使用固定内容视图；外部编译依赖在准备期间变化时完整重同步。
- 直接受管 Tailwind 样式根复用 core 的内存生成与快照转换。来源枚举和匹配使用上游公开 API，输出目录不进入输入监听。
- JS 改写与传输包装组合 sourcemap；当前 Rolldown 未提供原始 Patch map 或只返回空 mappings 时，映射只能指向原始 Patch，不能伪造原始源码位置。

编译、队列、保留预算、输入视图和 sourcemap 分别抽入小模块。既有 `session.ts` 仍超过 300 行；本次保留其启动、完整构建和 watcher 生命周期，避免同时重写无关边界。

## 已执行验证

- package-scoped typecheck、build、公开类型测试。
- stateful HMR、Tailwind、fake provider、输出归属及 Vue bundle 的定向单元/集成测试：55 个文件、404 个用例通过，包含空样式边界、空 map 与批次分类回归。
- E2E manifest 与构建日志诊断：47 个用例通过。
- 真实 DevEngine 输入版本及虚拟入口回归。
- provider-compatible headless（移除诊断日志后连续两轮通过，包含实际 sourcemap）：类名替换/删除、共享候选保留、主题变化、扫描文件删除/新增、后续 JS 更新、class 与 CSS selector 一致、状态保持及样式 mtime 不变。
- simulator 单元回归与真实 Chromium 执行确认回归。
- 文档站构建和 SEO 检查。

最终代码整理后的命令和结果以当前工作记录为准；上述局部通过不替代官方 IDE 的运行时验收。

## 真实微信结果与阻塞

官方微信开发者工具 `2.02.2609231`、基础库 `3.17.3` 已实际进入用例。初始颜色检查通过；首次更新后，页面 class 与 emitted CSS selector 一致，交互计数保留，但背景计算值为 `rgba(0, 0, 0, 0)`，预期为 `rgb(219, 234, 254)`。失败断言保留，没有增加 skip 或用完整重载掩盖失败。

该现象与 `docs/plans/2026-09-20-devtools-style-hmr-diagnostic.md` 中的宿主样式更新丢失相似，但本轮尚未建立新版本的文件级因果链，不能直接认定为同一根因。Computer Use 的应用发现被 macOS 锁屏阻断，自动解锁失败，真实 UI 复核尚未完成。

## 尚未关闭的验收项

- 官方 DevTools 中样式真正生效，以及同批次样式提交与页面应用的协调边界。
- 导入式 Tailwind 样式 owner 的完整增量覆盖；当前无法固定归属时明确完整重同步，不交付不一致的 Patch。
- CSS Modules、配置依赖组合及更复杂多 root 场景的完整 runtime 验收矩阵。
- PR、跨平台 CI 和最终交付；必须在解决上述运行时门禁后继续。
