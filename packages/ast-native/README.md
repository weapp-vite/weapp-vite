# @weapp-vite/ast-native

weapp-vite 的可选 Rust/Oxc AST 分析原型。用于构建期，不用于小程序宿主运行时。

## 安装

```bash
pnpm add @weapp-vite/ast-native
```

## 使用

通过 `WEAPP_VITE_NATIVE=1` 和 `WEAPP_VITE_NATIVE_AST_PATH` 同时显式启用；后者指向当前平台可加载的 binding 模块入口。未启用、加载失败或解析失败时，`@weapp-vite/ast` 使用原有 JS 分析路径。直接调用本包的低层 binding 时，调用方负责处理错误。

批量入口在需要 AST 时对每份源码最多解析一次，返回 static require、平台 API、feature flags 和适用的 `onPageScroll` 诊断。多文件入口减少 N-API 往返，不承诺并行处理。上层公共分析结果保持原有形状；诊断复用只在源码和解析条件兼容时成立，不跨源码转换阶段复用旧结果。显式选择 Oxc 的滚动诊断仍使用原有 Oxc 路径。

### 编译器批量摘要实验

`analyzeCompilerScriptsNative(inputs[])` 在一次 N-API 调用中，按 `(code, filename)` 复用解析，返回 imports、default export、静态宏、require、平台 API 与 feature flags 等摘要。`defineOptionsStatements` 使用 JavaScript UTF-16 偏移，供上层对原始语句计算 hash；`registeredComponents` 仅覆盖已证明的直接静态对象，复杂注册返回 `undefined`，继续由 Babel 处理。

结果与输入逐项对应；解析失败或无法无损转换的源码项返回 `null`，有效邻项仍可复用。上层 `analyzeCompilerScriptsWithNative` 校验结果形状、范围和顺序，失败项只请求一次回退；未启用返回 `undefined`。resolver、文件 I/O、Babel AST 与最终 generate/sourcemap 仍由 JS 负责。此实验不是完整 Rust 编译器。

## 验证性能

在仓库内构建 release binding 和受影响的 JS 包后运行：

```sh
pnpm --filter @weapp-vite/ast-native native:build
pnpm exec turbo run build --filter=weapp-vite...
pnpm profile:compiler
pnpm benchmark:native-analysis --mode=smoke --output=.codex-tmp/native-analysis-smoke --native-path=packages/ast-native/index.js
```

`profile:compiler` 观测真实编译入口；`smoke` 只验证采集和正确性。正式 native off/on 对照使用 `--mode=full`，每个构建/HMR 场景固定 40 对交替样本，核对输入、产物与告警，并报告 P50、P95、RSS 和未完成项。所有 HMR/E2E 采集必须全局串行。局部分析倍率不等于构建或 HMR 倍率，未达到门槛时保持实验性启用。

采样契约见 [基准工具说明](../../scripts/benchmarkNativeAnalysis/README.md)。完整文档与源码位于 [weapp-vite](https://github.com/weapp-vite/weapp-vite)。
