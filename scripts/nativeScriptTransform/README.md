# 实际 transformScript 捕获与 Rust 打印探针

这是完整脚本阶段迁移前的兼容性实验。它捕获生产源码中的真实 `transformScript` 请求，再将**现有 JS 转换器已生成的 JavaScript** 交给 Oxc 0.152 做 parse、语义校验、打印和 sourcemap。它尚未实现 Vue/Wevu 改写，没有接入生产入口，也不产生性能结论。下一阶段的语义与 map 边界见 [BOUNDARY.md](./BOUNDARY.md)。

## 运行

```sh
pnpm --filter @weapp-vite/ast-native exec napi build --platform --release --features experimental-script-transform --no-js --dts target/script-transform-experiment.d.ts --output-dir ../../.codex-tmp/script-transform-native
node --import tsx scripts/nativeScriptTransform/check.ts --binding-dir=.codex-tmp/script-transform-native --output=.codex-tmp/script-transform-probe
```

输出目录必须不存在。默认任何打印结构、注释或位置检查差异都会返回失败；已知差异调查可显式传 `--allow-differences`。该参数只允许完成诊断，摘要仍保留 `comparisonPassed: false`；CI 的诊断步骤成功不表示打印器可替换现有 generator。捕获、完整产物对照、运行、清理或来源校验失败在两种模式下均失败。

## 正确性与所有权

三个独立 Node 进程串行执行同一批 45 个场景，各重复两轮：原始编译器、四项脚本优化后的 JS、同样优化并附加捕获器的 JS。完整 code、maps、warnings、错误诊断逐字比较，共 270 次检查。真实两页保留在这套语料中，没有裁掉 class、key 投影或 inline events。

捕获器安装早于原有 loader，在目标 resolve 后注册最终观察器，经 `nextLoad` 接收已有 owner 返回的优化源码。严格匹配入口、fastSetup 和 warning 三处锚点；不绕过已有 loader 或重读原文件替换其结果。每次调用保留对应 record 索引；验证连续完整覆盖、两轮重复结果，以及既有 AST transfer 与 batch owner 已清空。

原 options、warn callback、隐藏 AST transfer symbol 和返回值在真实调用中原样流转。私有记录使用 tagged tree 保存 undefined、负零、数组空洞、属性描述符；不支持的 accessor、循环数据、函数或未知 symbol 会显式失败。表达式字段分别生成源字符串并保留根 span 与身份，记录 JS generator 次数和 UTF-16 字符量。这个 bridge 有实际成本；根 span 也不能恢复所有子 token 的跨来源映射。

warning 记录区分 handler 与 console 两个观察通道；默认 handler 可能继续调用 console，因此通道数不能相加作为公开告警条数。编译器公开 warnings 仍以完整对照输出为准。

## 打印与 map

每个成功 stage 返回的 JS 和独立语法样本都使用两种 minify 配置调用 `roundTripScriptNative`。单次 N-API 请求完成 JS parse、语义校验、codegen，返回紧凑 code/map/diagnostics，不返回 AST，也不逐节点回调。

`.ts`、`.tsx`、`.jsx` 明确 unsupported；伪装为 `.js` 的 TS/JSX 是解析错误。孤立 UTF-16 surrogate 被拒绝，合法 JS 字符串 escape 仍可保留。诊断 range 与 map 坐标按 UTF-16 检查。

打印结果的 exact code 差异、去位置 AST 结构、注释及 annotation 归属、token/identifier 映射检查分别报告。实际组合新 map 与既有 stage map，再从生成坐标查询原来源。覆盖的是探针定义的锚点，不是所有 token 末尾、断点策略或小程序 runtime。metadata 新合成表达式的来源仍需完整转换器另行解决。

`report.json`（各 worker）与 `printer-report.json` 保留私有原始源码、完整结果和 maps。公共 `summary.json` 只保留源哈希、输出摘要、检查差异和限制，不上传完整捕获源码；CI 只上传该摘要。源文件与 binary hash 在运行前后复核，不能单凭这些 hash 证明 binary 的构建来源或每个安装依赖文件。

## 局部检查

```sh
cargo test --locked --manifest-path packages/ast-native/Cargo.toml --features experimental-script-transform,napi/noop,napi-derive/noop script_transform::tests
pnpm exec tsc -p scripts/nativeScriptTransform/tsconfig.json
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeScriptTransform
pnpm exec eslint scripts/nativeScriptTransform .github/workflows/ci-native-analysis.yml
```

所有新增实现按职责拆分，单文件保持 300 行以内。实验 feature 默认关闭，未改公开 TypeScript/native wrapper 或生产配置；本轮属于内部诊断工具，无 changeset 与脚手架版本联动。
