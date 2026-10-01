# 原生监听连续保存与 DevEngine 宿主边界

## 复现与边界

组合验证中曾两次出现 `vite-watch.test.ts` 路由删除后仍保留旧 `app.json` 的结果；临时诊断通过不能证明问题消失。独立于框架插件的原生 Vite 对照连续创建新依赖、在观察到本轮产物后立即保存下一轮输入，在 Rolldown 1.2.11 下出现输入版本 100、产物版本 99，最后一次保存后没有新的 `watchChange`。没有额外 OS watcher、第二次保存、轮询或输出补写。

上游 [rolldown/rolldown#10992](https://github.com/rolldown/rolldown/pull/10992) 说明：旧实现未先过滤已有监听路径，就打开原生监听批次。macOS FSEvents 在打开批次时停止当前流、提交时从 SinceNow 重启，期间的保存可能丢失。1.2.12 在没有新路径时直接返回，避免重启空批次；上游同时提供将保存精确安排在旧窗口内的 Rust 回归。

本次更新锁定 Rolldown 1.2.12，Vite 保持 8.3.1。相同纯 Vite 对照在升级后完成 100 次拓扑更新。仓库新增真实 Vite 原生监听回归并纳入三系统 Native path controls 门禁。该 JS 回归覆盖用户保存节奏，上游 Rust 测试覆盖确定性的底层窗口；这不证明全部历史 watch 超时或 Linux/Windows 失败具有同一根因。

## 状态保持 HMR 的兼容适配

1.2.12 明确拒绝 DevEngine 的 CJS 输出，且运行时辅助函数可能已内联到公共入口。继续依赖旧的隐式行为会在 stateful 启动阶段失败。

- DevEngine 使用其支持的 ESM 图协议，由原生引擎生成完整的初始依赖图。
- 现有 stateful 插件槽的 `renderChunk` 使用明确依赖的 Babel CommonJS 模块转换，保留宿主原有 CommonJS 加载契约与 sourcemap；最终文件仍由 Vite/Rolldown 原生写出。
- 删除原 CJS 首包图补齐代码，避免与上游生成的图重复注册。保留模块根目录与跨平台 ID 规范化。
- 公共运行时校验同时接受独立辅助模块和入口内联辅助函数；缺少必须契约仍报错。
- Native DevEngine 测试验证原生图的静态/动态依赖、跨 chunk require、外部模块的宿主所有权，以及 Component/Page 的更新和恢复；不靠手造图替代引擎输出。

## 验证要求

- 依赖安装及版本一致性检查；catalog / create changeset 检查。
- stateful 单元/原生测试、React/worker/library/watch 集成、package typecheck 与 public types。
- 重建包后，严格 headless 与官方最新 Stable 验证原生 Component、父子原生/Vue 组件、Wevu local/store 状态及脚本恢复，检查实际 IDE/SDK 和零运行时诊断。
- 等待新提交全部 CI，特别是三系统 Native path controls；同步组合分支后再次验证组合行为，不能借依赖升级直接宣称先前失败已修复。

格式转换独立为小模块。既有 `viteAdapter.ts` 超过 300 行，本次仅调整其引擎格式策略，未把无关会话生命周期拆分混入依赖修复。
