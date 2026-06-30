# ast-native 迁移可行性与收益评估

## 结论

当前不建议把 `weapp-vite` / `wevu-compiler` 中的 Babel AST 处理整体迁移到 `@weapp-vite/ast-native`。真实 profile 显示，完整 SFC 编译里最明确可归因的 `transformScript` Babel 核心链路约占 18.5%，`compileScriptPhase` 下界约占 26.2%；即便假设完整 AST 链路有 2.43x 加速，完整 SFC 的保守收益也约为 1.18x。

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
| transformScript 入口 | 10.814 ms |
| Babel parse | 0.356 ms |
| page feature flags | 0.019 ms |
| Vue SFC transform traverse | 0.771 ms |
| macro/import/collect traverse | 0.839 ms |
| template component meta prune | 0.920 ms |
| rewriteDefaultExport | 2.197 ms |
| Babel generate | 4.803 ms |
| profile total | 9.909 ms |

`transformScript` 本身几乎都是 AST parse/traverse/rewrite/generate 工作，其中 generate 是最大单项。

### compileVueFile

| 阶段 | 平均耗时 |
| --- | ---: |
| parseVueFile | 32.431 ms |
| collectComponentSourceInfo | 1.157 ms |
| Vue compileScript | 0.927 ms |
| compileTemplatePhase | 3.539 ms |
| compileScriptPhase | 13.963 ms |
| compileStylePhase | 0.014 ms |
| compileConfigPhase | 0.203 ms |
| finalizeResult | 0.083 ms |
| total | 53.371 ms |

估算：

| 指标 | 数值 |
| --- | ---: |
| AST 下界占比（compileScriptPhase / total） | 26.2% |
| AST 上界占比（parseVueFile + compileScriptPhase / total） | 86.9% |
| transformScript Babel 核心链路 / SFC total | 18.5% |
| 2.43x 假设下保守收益 | 1.18x |
| 2.43x 假设下上界收益 | 2.05x |

`parseVueFile` 当前占比很高，但它包含 Vue SFC parse、JSON macro、hash/descriptor 等混合工作，不应直接视为可 native 化的 JS AST 开销。

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
