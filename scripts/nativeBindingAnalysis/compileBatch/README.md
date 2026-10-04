# 完整编译入口的绑定分析实验

仅用于新鲜诊断进程；不修改生产源码、公开 API 或默认 native 开关。先调用 `installCompileBatch`，再动态导入 `compileVueFile`。五种模式分别为原始 `eager-js`、同加载器原始逻辑 `control-js`、完整请求缓存 `planned-js`、精确表达式摘要缓存 `planned-summary` 和显式绑定的 `planned-native`。`eager-js` 不注册加载 hook，不进行预先 AST 分析，计数均为零。

`control-js` 对与 planned 模式相同的三份生产模块使用相同 URL、CRLF 规范化、`format: 'module'`、`shortCircuit: true` 和 `stripTypeScriptTypes(..., { mode: 'strip' })`，但保持原始源码，不添加 collector 导出、队列逻辑或诊断全局对象，计数均为零。安装时只预导入原始 binding 模块以核对它确实经过此次加载 hook，不获取或调用私有 collector。先比较 eager 与 control，判断默认 tsx 与 strip 的代码生成差异，再比较 control 与三个 planned 模式；不能把加载器差异归因于批处理或 Rust。

每轮调用 `reset()`，计时真实 `compileVueFile`，随后调用 `assertDrained()` 并读取 `snapshot()`。外部运行器负责产物、sourcemap、诊断与警告的严格对照，以及进程隔离和平衡采样。不能先编译一次来填充缓存或请求计划；预热后每次编译仍重新收集请求、分配队列并完成自己的分析。

模板遍历记录绑定时立即用生产规范化函数冻结表达式、外层循环表达式、locals、安全调用名称、显式 scope 及源码位置。批次只替换规范化后的基础依赖分析；原来的 loop 依赖合并、额外 scope 合并、绑定生成与顺序保留。潜在 loop/scope 分支会一起分析，主表达式解析失败时未被消费的请求计入 `unusedPreparedInputs`，其成本仍包含在完整编译中。

每个插槽子 manifest 在生成组件脚本前 flush，根 manifest 在保留插槽 owner 依赖前 flush。直接写入的 slot owner 绑定进入同一队列，生成时才读取 `bindings.length`，保持 ID 与原始顺序。layout／JSX 后续合成绑定没有统一的模板消费边界，保持同步 eager，计入 `unbatchedCalls`。通过模板入口的 JSX 仍按正常模板生命周期 flush。

`planned-native` 每个非空 manifest 批次至多一次 NAPI 调用。调用异常或返回结构错误时，整批通过冻结请求回退生产 JS 分析，记录 `fallbackCount`、原因和实际尝试的 `nativeCalls`；外部性能验收应拒绝任何回退。合法的解析失败 `null` 仍按原生产逻辑生成 snapshot fallback。所有缓存只存在于本轮 flush 内。

模板异常会清除它拥有的队列，并记录 `abortedTemplates`、`discardedRecords`。未经过正常结束或 abort 的 pending 工作会使 `reset()`、`assertDrained()` 和 `dispose()` 报错。`dispose()` 即便遇到 pending 错误也解除 hook 和诊断全局对象；随后必须退出进程，不能继续使用已缓存的注入模块或在同一进程切换模式。

源码替换对每个关键锚点要求唯一匹配；源码 hash 只标识三份被注入的生产文件，不代表整个编译器或依赖树。局部静态行为由目录单测验证，真实编译对照由外部运行器验证：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeBindingAnalysis/compileBatch
pnpm exec tsc --noEmit -p scripts/nativeBindingAnalysis/tsconfig.json
pnpm exec eslint scripts/nativeBindingAnalysis/compileBatch
```
