# ast-native 迁移可行性与收益评估

## 结论

当前不建议把 `weapp-vite` / `wevu-compiler` 中的 Babel AST 处理整体迁移到 `@weapp-vite/ast-native`。真实 profile 显示，完整 SFC 编译里最明确可归因的 `transformScript` Babel 核心链路约占 18.3%，`compileScriptPhase` 下界约占 26.1%；即便假设完整 AST 链路有 2.43x 加速，完整 SFC 的保守收益也约为 1.18x。

建议继续采用“analysis-only 优先、transform-with-generate 保留 Babel”的路线，但要用真实热路径数据逐项放行。新增的 `require` / platform API / feature flags native POC 在本次 isolated benchmark 中没有变快，约为 baseline 的 0.83-0.94x，说明这类单次轻量分析会被 N-API 边界与 Rust parse 成本抵消；它们可以作为可选实验路径保留，但不应继续扩大为默认实现。

## 本次实测数据

命令：

```bash
pnpm exec tsx scripts/ast-migration-profile.ts
```

环境：本地 Node.js + 当前仓库源码，脚本内固定 20 次 warmup、160 次采样。该脚本是本地微基准，单次数字会随机器负载小幅波动，判断重点是阶段占比与 native/baseline 方向。

### transformScript

| 阶段 | 平均耗时 |
| --- | ---: |
| transformScript 入口 | 11.147 ms |
| Babel parse | 0.335 ms |
| page feature flags | 0.028 ms |
| Vue SFC transform traverse | 0.814 ms |
| macro/import/collect traverse | 0.811 ms |
| template component meta prune | 0.951 ms |
| rewriteDefaultExport | 2.237 ms |
| Babel generate | 4.737 ms |
| profile total | 9.915 ms |

`transformScript` 本身几乎都是 AST parse/traverse/rewrite/generate 工作，其中 generate 是最大单项。

### compileVueFile

| 阶段 | 平均耗时 |
| --- | ---: |
| parseVueFile | 32.606 ms |
| collectComponentSourceInfo | 1.202 ms |
| Vue compileScript | 0.950 ms |
| compileTemplatePhase | 3.624 ms |
| compileScriptPhase | 14.110 ms |
| compileStylePhase | 0.014 ms |
| compileConfigPhase | 0.201 ms |
| finalizeResult | 0.082 ms |
| total | 53.975 ms |

估算：

| 指标 | 数值 |
| --- | ---: |
| AST 下界占比（compileScriptPhase / total） | 26.1% |
| AST 上界占比（parseVueFile + compileScriptPhase / total） | 86.6% |
| transformScript Babel 核心链路 / SFC total | 18.3% |
| 2.43x 假设下保守收益 | 1.18x |
| 2.43x 假设下上界收益 | 2.04x |

`parseVueFile` 当前占比很高，但它包含 Vue SFC parse、JSON macro、hash/descriptor 等混合工作，不应直接视为可 native 化的 JS AST 开销。

### analysis-only native POC

新增 POC 覆盖 `mayContainStaticRequireLiteral`、`mayContainPlatformApiAccess` 与 `collectFeatureFlagsFromCode` 三类无代码生成分析路径，仍然通过 `WEAPP_VITE_NATIVE=1` 与 `WEAPP_VITE_NATIVE_AST_PATH` 显式启用，失败时回退 Oxc / Babel。脚本对比的是当前 Oxc baseline 与 native POC：

| 分析点 | Oxc baseline | native POC | 结果 |
| --- | ---: | ---: | ---: |
| static require literal | 1.832 ms | 2.002 ms | 0.92x |
| platform API access | 1.845 ms | 1.957 ms | 0.94x |
| feature flags | 1.808 ms | 2.179 ms | 0.83x |

结论：这三类轻量 analysis-only 热点在 isolated benchmark 里暂未证明收益。继续迁移前应优先找“同一次 native parse 能复用多项分析结果”的批处理入口，而不是把每个小检查都拆成一次独立 N-API 调用。

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

下一步不要继续按单函数粒度扩大 native 覆盖。更合理的试点方向是把同一份 JS/TS 源码的 `require`、platform API、feature flags、onPageScroll 等检查合并成一个 native batch analysis，一次 parse 返回多个结果；只有这个入口在 HMR profile 或 workspace audit 中证明 observed P95/max 改善后，才继续迁移更多 analysis-only 热点。`transformScript`、npm JS rewrite、JSX script transform 仍应保留 Babel，优先优化 `generate` 次数、Vue SFC parse 缓存、transformScript 重复遍历合并等更确定的问题。
