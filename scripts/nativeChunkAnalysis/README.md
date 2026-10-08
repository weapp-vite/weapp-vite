# 实验：产物改写的批量 Rust 摘要

当前实验只验证 `rewriteBundleNpmImportsByPlatform` 与 `rewriteBundlePlatformApi` 的解析替代边界，**未接入生产热路径，也不默认构建或启用**。

现有 native 预分析返回布尔值，命中后仍需要 Babel 再次解析。实验一次传入多个产物脚本，在 Rust 中对每份源码执行一次 parse 与作用域分析，返回未被局部变量遮蔽的静态 require 字面量和平台 API 对象的 UTF-16 区间。完整 AST 留在 Rust，不逐节点回调 JS。

JS 继续使用现有 npm 路径规范化、平台别名表达式和 sourcemap 组合。保留原来两阶段 MagicString 编辑；第二阶段区间根据第一阶段文本长度变化平移，从而避免重新解析且不改变映射组合顺序。NAPI/解析失败、结果缺失、无效区间和无法无损传输的 UTF-16 输入都会整批回退原实现。

## 运行

使用 `packages/ast-native/rust-toolchain.toml` 指定的 Rust 版本。启用 Cargo feature `experimental-chunk-analysis` 构建独立的 `.node` 文件，避免替换普通绑定：

```sh
pnpm --filter @weapp-vite/ast-native exec napi build --platform --release --features experimental-chunk-analysis --no-js --dts target/chunk-experiment.d.ts --output-dir ../../.codex-tmp/chunk-native-release
```

下面的 `binding.node` 指实际生成的架构文件。输出文件必须不存在；默认只做正确性检查，不计时。

```sh
node --import tsx scripts/nativeChunkAnalysis/check.ts --binding-dir=.codex-tmp/chunk-native-release --output=.codex-tmp/chunk-correctness-suite.json
node --import tsx scripts/nativeChunkAnalysis/run.ts --binding=.codex-tmp/chunk-native-release/binding.node --output=.codex-tmp/chunk-correctness.json
node --import tsx scripts/nativeChunkAnalysis/run.ts --binding=.codex-tmp/chunk-native-release/binding.node --input-dir=templates/weapp-vite-tailwindcss-tdesign-template/dist --output=.codex-tmp/chunk-tdesign.json
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeChunkAnalysis/rewrite.test.ts
pnpm exec tsc -p scripts/nativeChunkAnalysis/tsconfig.json
```

运行前关闭 `WEAPP_VITE_NATIVE`，确保对照组通过现有 JS 路径。输入目录不跟随符号链接，仅递归读取 JS；先按仓库 dist-sync 规则构建目标工程。差分必须同时满足无 fallback、代码一致、完整 map JSON 一致，不能把回退后的相同输出算作 native 通过。

`--input-dir` 包含复制的 npm 资源，不能当作构建实际改写工作量。需要真实 chunk 语料时，在仓库根目录重建 `weapp-vite`，通过诊断加载器运行一次单目标主包生产构建：

```sh
pnpm --filter weapp-vite build
```

设置环境变量 `WEAPP_VITE_CHUNK_CAPTURE=.codex-tmp/production-chunks.json`（文件须不存在）后执行：

```sh
node --import tsx --import ./scripts/nativeChunkAnalysis/capture.ts packages/weapp-vite/dist/cli.mjs build templates/weapp-vite-tailwindcss-tdesign-template
node --import tsx scripts/nativeChunkAnalysis/run.ts --binding=.codex-tmp/chunk-native-release/binding.node --input-bundle=.codex-tmp/production-chunks.json --output=.codex-tmp/chunk-production-replay.json --iterations=30
```

加载器使用 Node `registerHooks`，只在内存中的 built module 唯一 `resolveDevHmrRewriteBundle` 调用之后注入观测，不修改磁盘 dist 或 bundle。它记录原始构建配置、dist hash、chunk 源码与跳过的 asset 数量；源码锚点变化、未命中或多次捕获会失败。当前不支持多目标、独立分包或 watch 构建。原始捕获只作本地诊断，分享时先检查源码中的路径和其他私有信息。

需要局部配对采样时，先检查并等待同机 E2E/性能任务退出，再追加 `--iterations=30`。每次分别预建输入 chunk/identity map，计时覆盖实际改写函数或 native 调用、NAPI 数据转换、JS 编辑与 sourcemap 组合；执行 8 对预热，然后交替 JS/native 先后顺序，保留原始样本和 P50/P95。不可使用 debug binding 作性能结论。

## 结论边界

- 默认语料是小型语义样本；`--input-dir` 是包含复制资源的 JS 语料，`--input-bundle` 则是生产改写边界捕获的 chunk。两者都是局部重放，不是完整 Vite 构建或 HMR。
- 两种 map 模式使用为每份输入新建的 identity map，验证与生产路径相同的外置/内联映射组合；没有读取工程原来的 map 文件。报告不得声称原工程 sourcemap 的端到端验收。
- 目标是支付宝 npm 路径规范化加平台 API 改写。没有迁移本地 npm root 的 `__toESM` 互操作传播或其他平台处理，也没有把这部分耗时算作已优化。
- 重放固定使用 `alipay` 与 `wpi`，不自动复现捕获工程的平台与功能开关。报告同时记录捕获配置和重放配置，二者不一致时不得描述成原项目自然改写阶段的提速。
- 实验复用生产 warmup 的文本候选过滤，报告分别记录 native 输入与被跳过的输入。转义标识符等预筛选边界也保持现有行为；正式接入前仍需评估批次失败放大、RSS 和缓存失效。
- 正式扩大 native 覆盖仍需代表工程端到端配对采样、原始产物/maps/告警一致、失败回退与跨平台验证；局部倍率不能替代这些门禁。

## 模板解析归因

独立的计数工具可以核实固定 SFC fixture 中 Babel parse 的调用点：

```sh
node --import tsx scripts/astMigrationProfile/attribution.ts --output=.codex-tmp/manifest-attribution.json
```

工具执行 5 次预热、1 次真实 `compileVueFile`，通过可选观测门面采集调用栈和计数。调用栈收集有明显开销，报告刻意不包含计时；不能将次数占比当作 CPU 耗时占比。该入口用于区分 JS 去重机会与 Rust 迁移收益。
