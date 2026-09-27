# Issue #1082：未启用 Tailwind 的更新不再创建编译器

在 `d5fbe5a8e39429daaf30a4a689ddd34287af62d8` 上，仅覆盖更新阶段的 CPU 诊断发现：未使用 Tailwind CSS 的 20 组件 manual 场景，首次更新经 `watchChange → invalidateCompilerForFile → getCompiler → getCoreModule` 加载 Tailwind 编译器。该调用链包含约 100.834ms 的采样时间，主要是首次模块加载，并非函数自身独占耗时。

## 根因与修正

自动检测到已安装 Tailwind v4 时，插件本来应在发现 CSS 导入之前保持休眠。但失效路径无条件调用 `getCompiler()`，即使没有生成过任何 CSS，也创建编译器来失效空缓存。首次构建的休眠测试没有覆盖此后更新。

新增 watchChange、handleHotUpdate、buildStart 三条未使用路径，以及生成前样式脏标记回归，修正前四项全部失败。现在失效操作只等待已有 compilerPromise；样式索引、缓存清理和脏标记仍照常维护，存在编译器时继续 invalidate/remove。另补休眠后首次遇到 Tailwind 导入能正常生成 CSS、后续源变更继续失效的回归。

既有 Tailwind 集成的大文件只改动失效边界；测试继续复用该文件中的编译器 mock 与上下文夹具，没有复制完整测试基础设施。没有改变自动检测、CSS 生成、模块安全判断或正式性能门禁。

## 验证

- Tailwind 集成 27 项通过，包含四项先失败的回归、后续首次激活、既有生成/删除失效契约。
- weapp-vite typecheck、public types、scoped ESLint、重建 dist 通过；完整 stateful headless 门禁六场景 37/37 DOM 通过。
- 原生 Tailwind 模板及 Wevu/TDesign 模板 CLI 两项通过，覆盖生成 CSS 更新/恢复及原有堆内存上限。
- 同一单配置更新阶段诊断中，修正后没有采到上述编译器加载调用链，子进程也不再输出 Tailwind 编译器加载日志。诊断只用于定位多余初始化，不将单次差值或采样占比换算为三 OS 性能收益。

## 未完成的 runtime 验收

真实计算样式场景在 headless 中被现有能力检查拒绝：逻辑节点不能提供 layout/computed-style 验收，0 DOM；没有放宽断言。

真实 DevTools 的同一 TDesign 场景在初始化阶段超时，0 用例、0 DOM。Computer Use 确认 IDE 显示“模拟器长时间没有响应”，日志订阅重试未使启动在原 90 秒期限内完成。固定版本观察中曾点击“暂停模拟器”尝试诊断，随后测试清理关闭应用，相关干预保留在记录中。

为避免把它误判为本修正引入，临时恢复修改前 `d5fbe5a8e` 的产品源码、重建 dist，运行相同场景和期限；同样得到启动超时及无响应 UI。修改前对照仅做只读 Computer Use 观察，没有暂停操作。该现象发生于本次修正之前，但唯一启动故障原因尚未确认，不能记作 runtime 通过。对照结束后已恢复修正源码并重建 dist。

随后保持原基础库 3.15.0，仅把 useIsolateContext/useMultiFrameRuntime 设为 false 的受控对照，仍于同一 90 秒启动阶段超时，0 用例、0 DOM；Computer Use 同样看到无响应弹窗。临时 suite 已恢复，正式断言未更改。PR 继续草稿，完整真实模板与性能验收仍未完成。

public types 首次检查曾解析到外层工作区的旧产物：本地 node_modules/weapp-vite 自链接失效。确认本 worktree 的新声明包含对应导出后，仅修复本地链接，完整 public types 通过；没有为错误依赖修改产品类型。修复链接后两项 CLI 再次通过，但随后发现外部 Harmony E2E，未取得其准确开始时间，不能据此宣称该次 CLI 整段独占。后续完整 headless 运行前后检查未见其他 E2E。

## 证据

[脱敏归档](./issue1082-tailwind-dormancy.json.gz) 解压 2646259 字节，SHA256 `67f98c353b63e06a069b258e76d160a6fdaaf56a651cd05b9eebab2a87288002`。包含先失败/后通过日志、更新阶段 CPU profile 与 trace、CLI、headless 能力限制、真实 IDE 修改前后失败和 UI 观察摘要；原始 SHA 单列。临时 benchmark 插桩已恢复，没有提交机器路径、AppID 或安装 IDE 源码。
