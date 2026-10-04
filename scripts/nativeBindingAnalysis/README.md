# 实验：模板绑定表达式的批量 Rust 分析

本实验验证 manifest 依赖分析的计算边界，默认不编译、不导出生产 JS API，也没有接入模板编译热路径。

`capture.ts` 在真实 `compileVueFile` 中捕获 `collectDependencies` 完成 normalization 后的表达式、locals、safe-call 名称，以及循环依赖合并前的 Babel 结果。Node 加载钩子只修改本进程内的源码，不改磁盘源码或 dist；生产源码 hash、输入及最终编译结果 hash 随报告保存。捕获过程不计时。

`run.ts` 用同一批请求比较三个实现：

- 原始 JS：每次请求调用生产分析函数。
- JS 去重：本批次按完整请求去重后调用相同函数。
- Rust 批量：按相同请求键去重，一次 NAPI 传入唯一请求，再恢复原顺序。

为了保持计时边界一致，重放时只在内存中绕过已经完成的 normalization；JS 的 AST 分析主体仍来自生产函数，没有复制另一套 Babel 实现。每项结果必须与编译时捕获的 oracle 严格一致。原始 JS、JS 去重和 Rust 任一不一致，或 native 发生任何 fallback，都会使实验失败并禁止计时。

## 复现

先按仓库规则构建工作区依赖。使用固定 Rust 工具链构建独立 feature 绑定，不覆盖默认 `.node`：

```sh
pnpm exec turbo run build --filter=weapp-vite...
pnpm --filter @weapp-vite/ast-native exec napi build --platform --release --features experimental-binding-analysis --no-js --dts target/binding-experiment.d.ts --output-dir ../../.codex-tmp/binding-native-release
node --import tsx scripts/nativeBindingAnalysis/check.ts --binding-dir=.codex-tmp/binding-native-release --output-dir=.codex-tmp/binding-correctness
```

检查入口串行运行真实 binding 差分、真实编译捕获和重放，不执行性能计时。输出目录必须不存在；所有入口的输出 JSON 也拒绝覆盖。环境变量 `WEAPP_VITE_NATIVE` 应取消或设为 `0`，以保留独立 JS 基线。

也可分别捕获压力 fixture 和仓库现有页面。`--source` 使用统一的页面编译选项，报告会记录它们；这不是加载完整工程配置的 Vite 构建：

```sh
node --import tsx scripts/nativeBindingAnalysis/capture.ts --output=.codex-tmp/binding-profile.json
node --import tsx scripts/nativeBindingAnalysis/capture.ts --source=apps/wevu-vue-demo/src/pages/index/index.vue --output=.codex-tmp/binding-wevu.json
node --import tsx scripts/nativeBindingAnalysis/capture.ts --source=templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue --output=.codex-tmp/binding-retail.json
```

确认同机 E2E、构建和其他性能任务已退出后，用实际生成的 release 文件替换下面的 `binding.node`。不传 `--iterations` 则只检查正确性：

```sh
node --import tsx scripts/nativeBindingAnalysis/run.ts --binding=.codex-tmp/binding-native-release/binding.node --input=.codex-tmp/binding-profile.json --output=.codex-tmp/binding-replay.json --iterations=30
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeBindingAnalysis/replay.test.ts
pnpm exec tsc -p scripts/nativeBindingAnalysis/tsconfig.json
```

计时包含请求去重、NAPI 输入输出、结果验证和恢复顺序；六轮预热后按三种实现的六种排列轮转。每批缓存重新创建，不能把上轮缓存命中当作 Rust 加速。Node 加载钩子需要独立诊断进程；锚点改变或模块已缓存时会失败。

## 保留的语义与边界

- 表达式内部词法绑定、静态/动态成员路径、访问顺序、去重、safe-call 与 snapshot fallback 必须对齐。JS 把现有 INLINE_GLOBALS、Babel globals 和普通对象原型名称传给 Rust，保留当前过滤行为。
- 原始及转义后的孤立 UTF-16 代理字符不能有损传输；无法分析的 native 输入或无效批量结果整批回退。解析失败的 `null` 与成功但无依赖的结果保持区分。
- 外部作用域规范化、循环来源依赖合并、JSX `scopeDependencies`、manifest ID/位置/输出路径及同步 slot script 消费仍由现有 JS 流程负责，未迁移。
- 当前离线重放先收集完整语料；生产流水线尚不能直接把所有分析延迟到模板结束。scoped-slot 子脚本会在遍历中立即使用 manifest，必须解决生命周期后才能接入完整批次。
- 本实验的局部 P50/P95 不证明完整编译、构建或 HMR 收益，也不覆盖 RSS、原工程 sourcemap 和运行时验收。JS 去重对照用于分清减少重复工作与换语言的贡献。
