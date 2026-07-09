# ast-native 迁移可行性与收益评估

## 结论

当前不建议把 `weapp-vite` / `wevu-compiler` 中的 Babel AST 处理整体迁移到 `@weapp-vite/ast-native`。真实 profile 显示，完整 SFC 编译里最明确可归因的 `transformScript` Babel 核心链路约占 19.0%，`compileScriptPhase` 下界约占 27.4%；即便假设完整 AST 链路有 2.43x 加速，完整 SFC 的保守收益也约为 1.19x。

建议继续采用“analysis-only 优先、transform-with-generate 保留 Babel”的路线，但要用真实热路径数据逐项放行。新增的 `require` / platform API / feature flags 单点 native POC 没有变快，约为 baseline 的 0.83-0.87x；把三项合并为一次 `analyzeScriptNative` 后，连续检查场景提升到 1.32x。这说明用户判断成立：Rust 加速构建的关键之一是减少 JS ↔ Rust 通信次数，并让同一份源码的多个 AST 分析共享一次 parse。

## 本次实测数据

命令：

```bash
pnpm exec tsx scripts/ast-migration-profile.ts
```

环境：本地 Node.js + 当前仓库源码，脚本内固定 20 次 warmup、160 次采样。该脚本是本地微基准，单次数字会随机器负载小幅波动，判断重点是阶段占比与 native/baseline 方向。

### transformScript

| 阶段 | 平均耗时 |
| --- | ---: |
| transformScript 入口 | 10.587 ms |
| Babel parse | 0.335 ms |
| page feature flags | 0.016 ms |
| Vue SFC transform traverse | 0.761 ms |
| macro/import/collect traverse | 0.796 ms |
| template component meta prune | 0.941 ms |
| rewriteDefaultExport | 2.168 ms |
| Babel generate | 4.594 ms |
| profile total | 9.614 ms |

`transformScript` 本身几乎都是 AST parse/traverse/rewrite/generate 工作，其中 generate 是最大单项。

### compileVueFile

| 阶段 | 平均耗时 |
| --- | ---: |
| parseVueFile | 30.056 ms |
| collectComponentSourceInfo | 1.092 ms |
| Vue compileScript | 0.808 ms |
| compileTemplatePhase | 3.397 ms |
| compileScriptPhase | 13.844 ms |
| compileStylePhase | 0.013 ms |
| compileConfigPhase | 0.192 ms |
| finalizeResult | 0.075 ms |
| total | 50.479 ms |

估算：

| 指标 | 数值 |
| --- | ---: |
| AST 下界占比（compileScriptPhase / total） | 27.4% |
| AST 上界占比（parseVueFile + compileScriptPhase / total） | 87.0% |
| transformScript Babel 核心链路 / SFC total | 19.0% |
| 2.43x 假设下保守收益 | 1.19x |
| 2.43x 假设下上界收益 | 2.05x |

`parseVueFile` 当前占比很高，但它包含 Vue SFC parse、JSON macro、hash/descriptor 等混合工作，不应直接视为可 native 化的 JS AST 开销。

### analysis-only native POC

新增 POC 覆盖 `mayContainStaticRequireLiteral`、`mayContainPlatformApiAccess` 与 `collectFeatureFlagsFromCode` 三类无代码生成分析路径，仍然通过 `WEAPP_VITE_NATIVE=1` 与 `WEAPP_VITE_NATIVE_AST_PATH` 显式启用，失败时回退 Oxc / Babel。脚本对比的是当前 Oxc baseline、单点 native POC，以及批处理 `analyzeScriptNative`：

| 分析点 | Oxc baseline | native POC | 结果 |
| --- | ---: | ---: | ---: |
| static require literal | 1.764 ms | 2.023 ms | 0.87x |
| platform API access | 1.833 ms | 2.127 ms | 0.86x |
| feature flags | 1.816 ms | 2.195 ms | 0.83x |
| sequential all | 5.516 ms | 4.190 ms | 1.32x |
| direct batch native | - | 2.186 ms | - |

结论：这三类轻量 analysis-only 热点以单函数粒度迁移时暂未证明收益；合并为一次 native batch analysis 后，连续三项检查已出现正收益。继续迁移应沿着“同一次 native parse 复用多项分析结果”的方向，而不是把每个小检查都拆成一次独立 N-API 调用。

## HMR 验证

命令：

```bash
pnpm performance:report -- --mode=full --runs=hmr-lab,hmr-lab-native,workspace-hmr
```

本次报告目录：`.tmp/performance-report/20260630133641`。

| 套件 | 状态 | 关键结果 |
| --- | --- | --- |
| HMR Lab | passed | 24 个场景，4 个场景超时 |
| HMR Lab Native | passed | 24 个场景，4 个场景超时 |
| Workspace HMR Audit | passed | 12/12 measured，P95 208.7ms，max 208.7ms，threshold issues 0 |

`hmr-lab` 与 `hmr-lab-native` 的失败集合完全一致，均为 `app-script`、`shared-scss`、`shared-template-import`、`shared-template-include`，没有出现 native-only 失败。SFC 场景的平均 observed 时间如下：

| 场景 | Babel/Oxc baseline | Native enabled |
| --- | ---: | ---: |
| sfc-template | 135.31 ms | 124.39 ms |
| sfc-script | 116.55 ms | 111.46 ms |
| sfc-style | 119.78 ms | 107.85 ms |

这组数据说明 native POC 没有拉高 workspace HMR P95/max，SFC 热点有小幅可测收益；但 `hmr-lab` 同步失败场景仍存在，不能把这组数据解读为扩大 native 覆盖的充分理由。

## 已落地 POC

- `@weapp-vite/ast` 的 `onPageScroll` 诊断新增可选 native 路径。
- `@weapp-vite/ast` 的 static require、platform API、feature flags 分析新增可选 native POC 路径。
- `@weapp-vite/ast` 新增 `analyzeScriptNative` 批处理入口，TS 侧连续检查同一份源码时复用上一条 native 分析结果，减少 JS ↔ Rust 通信和重复 parse。
- `@wevu/compiler` 的导入 Vue SFC metadata 解析新增可选 native SFC signature 路径。
- native 路径仅在 `WEAPP_VITE_NATIVE=1` 且 `WEAPP_VITE_NATIVE_AST_PATH` 指向可加载模块时启用。
- native 加载或运行失败时回退现有 Babel / Vue compiler-sfc 路径，不引入发布必选依赖。

## 使用点分类

优先 native：

- SFC signature
- onPageScroll diagnostics
- component SFC metadata
- 需要多项分析共用一次 parse 的 batch-style analysis-only 入口

谨慎 native：

- setData pick
- require / platform API
- feature flags
- template expression
- JSX auto components
- script setup imports

暂不全替：

- transformScript
- npm JS rewrite
- JSX script transform

## 后续建议

下一步不要继续按单函数粒度扩大 native 覆盖。更合理的方向是继续扩展同一份 JS/TS 源码的 batch analysis，把 `onPageScroll`、setData pick 等分析逐步纳入一次 parse 返回的结构化结果；只有这个入口在 HMR profile 或 workspace audit 中证明 observed P95/max 改善后，才继续迁移更多 analysis-only 热点。`transformScript`、npm JS rewrite、JSX script transform 仍应保留 Babel，优先优化 `generate` 次数、Vue SFC parse 缓存、transformScript 重复遍历合并等更确定的问题。
