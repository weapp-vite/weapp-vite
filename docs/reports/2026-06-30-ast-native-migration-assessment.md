# ast-native 迁移可行性与收益评估

## 结论

当前不建议把 `weapp-vite` / `wevu-compiler` 中的 Babel AST 处理整体迁移到 `@weapp-vite/ast-native`。真实 profile 显示，完整 SFC 编译里最明确可归因的 `transformScript` Babel 核心链路约占 18.6%，`compileScriptPhase` 下界约占 26.8%；即便假设完整 AST 链路有 2.43x 加速，完整 SFC 的保守收益也约为 1.19x。

建议继续采用“analysis-only 优先、transform-with-generate 保留 Babel”的路线：native 先覆盖无代码生成、无 Babel `NodePath/scope` 强依赖的热点；`transformScript`、npm JS rewrite、JSX script transform 暂不全量替换。

## 本次实测数据

命令：

```bash
pnpm exec tsx scripts/ast-migration-profile.ts
```

环境：本地 Node.js + 当前仓库源码，脚本内固定 20 次 warmup、160 次采样。

### transformScript

| 阶段 | 平均耗时 |
| --- | ---: |
| transformScript 入口 | 11.249 ms |
| Babel parse | 0.407 ms |
| page feature flags | 0.020 ms |
| Vue SFC transform traverse | 0.810 ms |
| macro/import/collect traverse | 0.842 ms |
| template component meta prune | 0.949 ms |
| rewriteDefaultExport | 2.183 ms |
| Babel generate | 4.918 ms |
| profile total | 10.134 ms |

`transformScript` 本身几乎都是 AST parse/traverse/rewrite/generate 工作，其中 generate 是最大单项。

### compileVueFile

| 阶段 | 平均耗时 |
| --- | ---: |
| parseVueFile | 32.652 ms |
| collectComponentSourceInfo | 1.181 ms |
| Vue compileScript | 1.009 ms |
| compileTemplatePhase | 3.557 ms |
| compileScriptPhase | 14.590 ms |
| compileStylePhase | 0.015 ms |
| compileConfigPhase | 0.220 ms |
| finalizeResult | 0.082 ms |
| total | 54.396 ms |

估算：

| 指标 | 数值 |
| --- | ---: |
| AST 下界占比（compileScriptPhase / total） | 26.8% |
| AST 上界占比（parseVueFile + compileScriptPhase / total） | 86.8% |
| transformScript Babel 核心链路 / SFC total | 18.6% |
| 2.43x 假设下保守收益 | 1.19x |
| 2.43x 假设下上界收益 | 2.05x |

`parseVueFile` 当前占比很高，但它包含 Vue SFC parse、JSON macro、hash/descriptor 等混合工作，不应直接视为可 native 化的 JS AST 开销。

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
- `@wevu/compiler` 的导入 Vue SFC metadata 解析新增可选 native SFC signature 路径。
- native 路径仅在 `WEAPP_VITE_NATIVE=1` 且 `WEAPP_VITE_NATIVE_AST_PATH` 指向可加载模块时启用。
- native 加载或运行失败时回退现有 Babel / Vue compiler-sfc 路径，不引入发布必选依赖。

## 使用点分类

优先 native：

- SFC signature
- onPageScroll diagnostics
- component SFC metadata
- setData pick
- require / platform API
- feature flags

谨慎 native：

- template expression
- JSX auto components
- script setup imports

暂不全替：

- transformScript
- npm JS rewrite
- JSX script transform

## 后续建议

下一步只扩大到 `setData pick` 或 `require/platform API` 这类 analysis-only 热点，并继续保持 Babel/Oxc fallback。若 HMR profile 或 workspace audit 不能证明 observed P95/max 改善，应停止扩大 native 覆盖面，把精力放回 `generate` 次数、Vue SFC parse 缓存、transformScript 重复遍历合并等更确定的优化点。
