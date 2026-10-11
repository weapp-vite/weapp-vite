# 生产编译器 native 批量分析对照

直接调用当前源码的完整 `compileVueFile` 生产入口。`tsx` 只执行 TypeScript，不替换编译器源码、不安装实验 transform loader，也不手工复刻转换阶段。

先重建 native release binding 和生产入口依赖的 AST 包，然后由唯一性能采样负责人串行运行：

```sh
pnpm --filter @weapp-vite/ast-native native:build
pnpm --filter @weapp-vite/ast build
node --import tsx scripts/compilerBatchAnalysis/index.ts --mode=check --native-path=packages/ast-native/index.js --output=.codex-tmp/compiler-batch-check
node --import tsx scripts/compilerBatchAnalysis/index.ts --mode=full --native-path=packages/ast-native/index.js --output=.codex-tmp/compiler-batch-full
```

输出目录必须不存在。`check` 只做独立的 native off/on 正确性和诊断；`full` 追加固定 40 对，不能降低轮数。每对交替 off→on/on→off，每侧启动独立 Node 子进程，固定相同案例顺序，每例先执行两次完整预热再测一次。结果只描述暖编译入口，不代表冷启动、全项目构建或 HMR 的提速。任何失败立即停止，不重复采样挑选较快结果。

固定语料包含真实 Wevu 首页、真实零售详情，以及 defineOptions、双 script、无 default export、setup 导入组件、Options API 组件注册、转义孤立 surrogate 字符串、非法模板和非法脚本。真实页面源码原样读取；组件导入边界案例使用确定性 resolver，原样返回 import source，不读取组件文件。完整结果（包括 sourcemap、undefined 字段、warnings）和错误可观察字段（包括 name/message/code/loc/diagnostics/cause）在每次预热及实测后比较。错误栈因进程与调用位置不同不参与语义比较，原文保留在私有结果中。

错误证据保留字段值、描述符和受支持的原型。Babel 为每个错误生成独立 `clone` 闭包，函数引用无法跨进程比较；工具保留其源码、函数结构及无参、位置覆盖、details 覆盖三组行为探针。其他 callable、Symbol、未知原型或访问器均拒绝采样，不静默丢弃；Babel message 访问器保留源码及当前值。每次原始错误的完整 `inspect`（含非枚举字段和栈）另存于私有 worker 结果，探针不是任意函数语义等价证明。

worker 内比较实际返回对象；跨进程比较 V8 传输后的完整数据快照，不声称保留任意用户原型方法。错误原型与描述符已在传输前编码为显式证据。摘要 hash 使用该传输快照的既有 tagged tree 编码，保留 undefined、负零和数组空洞，避免将 V8 内部对象存储造成的二进制差异误判为产物变化。

计时子进程直接加载原 addon，不启用观察器或包装 binding。另起 off/on 诊断子进程，复用仓库的 compiler observer、native diagnostic channel 和 GC observer，报告进程 CPU、Babel wrapper parse/traverse/generate 计数、N-API 调用/输入数以及 GC。诊断单独包装 `analyzeCompilerScriptsNative`，每例必须命中一次，不能把其他 native 调用或静默 fallback 当作成功覆盖。非法脚本和转义孤立 surrogate 字符串预计各回退一次；其他正常 native 案例必须没有 fallback。故障 binding 只跑一次无 default export 案例，并验证一次批量调用、一次 fallback 和完整产物相等。

`summary.json` 脱敏且只保留输入、源码、addon 哈希和采样摘要；结束时重新核验源码、实际 AST dist、binding、工具及输入哈希。`.private/` 保存完整 V8 序列化结果、输入 job、错误栈和日志，使用 Node 的 `v8.deserialize` 可读取 `.bin`。私有文件包含原路径，仅上传 `summary.json`。文件 mode 在支持的平台限制本地访问，不把 Windows 文件 mode 当作 ACL 保证。

CPU 是观察窗口内的进程用量，不是阶段独占 CPU；GC duration 不是 CPU 时间；wall 减 CPU 不解释为等待。Babel wrapper 计数不包括 Vue/Oxc/Rust 内部 parse；调用或输入数不冒充 parse 次数。RSS 为每次编译后的 worker 快照，不是峰值。独立诊断包含观察器开销，不能混入正式计时。当前工具不评估构建/HMR 的 10%/5% 性能门禁，也不声称整个项目 Rust 化收益。

无需运行实际编译采样的工具回归：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/compilerBatchAnalysis
pnpm exec tsc --noEmit -p scripts/compilerBatchAnalysis/tsconfig.json
pnpm exec eslint scripts/compilerBatchAnalysis
```
