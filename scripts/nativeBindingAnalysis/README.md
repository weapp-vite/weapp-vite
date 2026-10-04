# 实验：模板绑定表达式的批量 Rust 分析

本实验验证 manifest 依赖分析的计算边界，默认不编译、不导出生产 JS API，也没有接入模板编译热路径。

`capture.ts` 在真实 `compileVueFile` 中捕获 `collectDependencies` 完成 normalization 后的表达式、locals、safe-call 名称，以及循环依赖合并前的 Babel 结果。Node 加载钩子只修改本进程内的源码，不改磁盘源码或 dist；生产源码 hash、输入及最终编译结果 hash 随报告保存。捕获过程不计时。

`run.ts` 用同一批请求比较四个实现；可选传入上轮绑定作为第五个对照：

- 原始 JS：每次请求调用生产分析函数。
- JS 去重：本批次按完整请求去重后调用相同函数。
- JS 摘要去重：先按完整请求去重，再按精确表达式缓存不可变语法摘要，按 locals/safe-call 特化结果。摘要仍来自生产分析函数，诊断用 `.has` 观察器仅记录可豁免的直接调用；不复制 Babel visitor，也不接入生产 compiler。
- Rust 批量：按相同请求键去重，一次 NAPI 传入唯一请求；Rust 在本次调用内按表达式缓存普通数据摘要，再按外部配置特化并恢复顺序。不同调用不共享缓存。
- 可选旧 Rust：`--previous-binding` 指定此前独立构建的实验绑定，与新实现使用相同适配器，单独保留二进制 hash。

为了保持计时边界一致，重放时只在内存中绕过已经完成的 normalization；JS 的 AST 分析主体仍来自生产函数，没有复制另一套 Babel 实现。每项结果必须与编译时捕获的 oracle 严格一致。任何 JS 或 Rust 对照不一致，或 native 发生任何 fallback，都会使实验失败并禁止计时。

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
node --import tsx scripts/nativeBindingAnalysis/run.ts --binding=.codex-tmp/binding-native-release/binding.node --input=.codex-tmp/binding-profile.json --output=.codex-tmp/binding-replay.json --iterations=40
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeBindingAnalysis
pnpm exec tsc -p scripts/nativeBindingAnalysis/tsconfig.json
```

计时包含请求/表达式缓存建立、摘要收集与特化、NAPI 输入输出、结果验证和恢复顺序；六轮预热后使用平衡执行位置和轮内相邻前序的顺序。四个实现为 4 轮一周期，加入旧 Rust 后为 10 轮一周期，建议用 40 轮完整覆盖。报告 schemaVersion 为 2，并保留实际预热次数、完整周期数、余数、是否完整平衡、时间和两份绑定 hash；无计时运行的预热次数为 0。每批缓存重新创建，不能把上轮缓存命中当作 Rust 加速。摘要中的依赖对象冻结，特化结果复制对象；解析失败的 null 也按精确表达式缓存，逐项输入校验不因命中缓存而跳过。Node 加载钩子需要独立诊断进程；锚点改变或模块已缓存时会失败。

新增 Rust 内部计数测试可验证实际 parse 次数。仅该纯 Rust 测试使用 `noop`；真实 Node 绑定构建不得加入这两个特性：

```sh
cargo test --locked --manifest-path packages/ast-native/Cargo.toml --features experimental-binding-analysis,napi/noop,napi-derive/noop binding_analysis::tests
```

## 保留的语义与边界

- 表达式内部词法绑定、静态/动态成员路径、访问顺序、去重、safe-call 与 snapshot fallback 必须对齐。JS 把现有 INLINE_GLOBALS、Babel globals 和普通对象原型名称传给 Rust，保留当前过滤行为。
- 原始及转义后的孤立 UTF-16 代理字符不能有损传输；无法分析的 native 输入或无效批量结果整批回退。解析失败的 `null` 与成功但无依赖的结果保持区分。
- 外部作用域规范化、循环来源依赖合并、JSX `scopeDependencies`、manifest ID/位置/输出路径及同步 slot script 消费仍由现有 JS 流程负责，未迁移。
- 当前离线重放先收集完整语料；生产流水线尚不能直接把所有分析延迟到模板结束。scoped-slot 子脚本会在遍历中立即使用 manifest，必须解决生命周期后才能接入完整批次。
- 本实验的局部 P50/P95 不证明完整编译、构建或 HMR 收益，也不覆盖 RSS、原工程 sourcemap 和运行时验收。JS 去重对照用于分清减少重复工作与换语言的贡献。
