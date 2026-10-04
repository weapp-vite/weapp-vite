# Native 懒加载四模式源码诊断

本工具在四个全新进程调用实际 AST 源码入口，核对加载、缓存、解析失败与恢复。它不启动构建、HMR、IDE 或性能采样，不改变生产源码、用户配置和默认 native 开关。

```sh
pnpm --filter @weapp-vite/ast-native native:build
node --import tsx scripts/nativeLoadDiagnostic/check.ts --output=.codex-tmp/native-load-source
```

默认要求 `packages/ast-native` 只有一个已构建 `.node`。也可显式传 `--binding=<release .node>`。输出目录必须不存在；工具不会覆盖、递归删除目录或复用旧进程轨迹。

| 模式 | 首次实际 binding 请求时的行为 |
| --- | --- |
| off | native 关闭，不初始化 wrapper、不加载 addon |
| on-no-load | wrapper 返回空对象，触发现有 JS fallback，不加载 addon |
| load-only | 同一实际请求边界加载真实 binding，随后返回空对象，走 JS fallback |
| actual | 加载真实 binding，透明转发原方法的返回值和异常 |

preload 只订阅事件。模块导入与无匹配 hint 的诊断必须保持无加载，不能为没有请求的工程强制预加载。wrapper 初始化只能证明首次未缓存的 require，无法观察 enabled checks 或每次 loader request。`analysisCacheHits` 是分析结果缓存命中；`observedFallbackEvents` 只统计现有 channel 发布的事件，部分缺失方法的回退没有事件，零值不能证明没有 fallback。

源码探针固定 `analyzeScript`/`analyzeScripts` 的 Oxc fallback，以比较精确布尔结果。默认 Babel helpers 没有 parser 时可保守返回 `true`，不能与 native 精确布尔值直接要求相等；此工具不改变这一生产契约。滚动告警保留默认路径，覆盖 native 缓存与 Babel fallback。

每个进程按 import、无 hint、批量分析、缓存告警、末项复用、无效源码、恢复执行。所有模式的完整结构化输出严格相等；验证器同时核对进程生命周期、逐条事件的阶段/顺序、真实 `.node` 缓存增量、对应缓存命中、失败回退和后续批量成功。无效源码故意触发 native 异常，不能将这些异常算作正常场景回退。

`report.json` 保存源码/配置/lockfile、绑定与私有原始文件的 hash，以及脱敏摘要。它不证明二进制由哪个源码版本构建，也不校验所有已安装依赖文件。`trace.jsonl`、生成的 preload/wrapper 和 owner 文件含本地进程或路径标识，仅保留本地；CI 只上传 `report.json`。加载耗时只存在私有轨迹中，包含观察器开销，不是性能样本。

后续真实 HMR 归因仍需显式接入驱动的 startup/edit/restore/cleanup 阶段，并处理 Windows 正常退出和各阶段产物对照。当前源码探针通过不替代这项验收，也不解释既有 HMR 尾延迟回退。

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/nativeLoadDiagnostic
pnpm exec tsc -p scripts/nativeLoadDiagnostic/tsconfig.json
pnpm exec eslint scripts/nativeLoadDiagnostic
```
