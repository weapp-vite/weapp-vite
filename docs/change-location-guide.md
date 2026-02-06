# weapp-vite 改需求定位指南

> 目标：当你拿到一个需求时，**先看哪里、再看哪里、最后在哪里改**。
>
> 配合文档：`docs/monorepo-architecture-map.md`

## 1. 使用方式（30 秒）

1. 先把需求归类到「CLI / 构建 / 插件 / 配置 / Wevu / 模板 / IDE / 文档」之一。
2. 在下面表格找到对应行，先打开「首查文件」。
3. 若首查文件没命中，再按「第二落点」顺序追。
4. 开改前确认是否影响 `apps/*`、`templates/*`、`create-weapp-vite` 联动。

## 2. 快速决策树

```text
需求是命令行行为？
  └─ 是 -> 看 weapp-vite/src/cli.ts + cli/commands/*

需求是构建产物/分包/chunk 问题？
  └─ 是 -> 看 runtime/buildPlugin + runtime/sharedBuildConfig + runtime/scanPlugin

需求是配置项新增/合并策略？
  └─ 是 -> 看 runtime/config/* + src/config.ts + src/types/*

需求是 Vue/Wevu 编译结果？
  └─ 是 -> 看 wevu-compiler/src/* + weapp-vite/src/plugins/wevu*

需求是 Web 端(h5/web)运行？
  └─ 是 -> 看 runtime/webPlugin.ts + packages/web/src/*

需求是新项目模板/初始化？
  └─ 是 -> 看 create-weapp-vite + templates/* + @weapp-core/init
```

## 3. 场景定位表（高频）

| 需求场景               | 首查文件                                                 | 第二落点                                                           | 典型改动点                      |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| 新增 CLI 子命令        | `packages/weapp-vite/src/cli.ts`                         | `packages/weapp-vite/src/cli/commands/*`                           | 注册命令 + option + action      |
| 修改 `build` 行为      | `packages/weapp-vite/src/cli/commands/build.ts`          | `packages/weapp-vite/src/runtime/buildPlugin/service.ts`           | build 流程、参数透传、日志      |
| 修改 `dev/serve` 行为  | `packages/weapp-vite/src/cli/commands/serve.ts`          | `packages/weapp-vite/src/runtime/buildPlugin/service.ts`           | watch 分支、host、分析面板      |
| 平台 `-p` 路由策略调整 | `packages/weapp-vite/src/cli/runtime.ts`                 | `packages/weapp-vite/src/cli/commands/build.ts`                    | mini/web 分流与 inlineConfig    |
| 新增/调整配置项        | `packages/weapp-vite/src/config.ts`                      | `packages/weapp-vite/src/runtime/config/*`                         | defineConfig 类型 + load/merge  |
| 插件顺序异常           | `packages/weapp-vite/src/plugins/index.ts`               | `packages/weapp-vite/src/runtime/config/internal/merge/plugins.ts` | plugin 组合顺序与插入点         |
| 分包共享 chunk 异常    | `packages/weapp-vite/src/runtime/sharedBuildConfig.ts`   | `packages/weapp-vite/src/runtime/chunkStrategy/*`                  | sharedStrategy/sharedMode       |
| auto-routes 相关       | `packages/weapp-vite/src/runtime/autoRoutesPlugin/*`     | `packages/weapp-vite/src/auto-routes.ts`                           | 路由收集、导出引用              |
| auto-import 组件相关   | `packages/weapp-vite/src/runtime/autoImport/*`           | `packages/weapp-vite/src/plugins/autoImport/*`                     | 扫描规则、产物输出              |
| npm 构建/依赖缓存      | `packages/weapp-vite/src/runtime/npmPlugin/*`            | `packages/weapp-vite/src/runtime/buildPlugin/service.ts`           | build 前后时机、cache 失效      |
| worker 构建/watch      | `packages/weapp-vite/src/runtime/buildPlugin/workers.ts` | `packages/weapp-vite/src/runtime/buildPlugin/service.ts`           | workerDir 检测与 watch          |
| Web 构建或 dev server  | `packages/weapp-vite/src/runtime/webPlugin.ts`           | `packages/web/src/*`                                               | weapp.web 配置与 web plugin     |
| WXML/WXS 转换          | `packages/weapp-vite/src/wxml/*`                         | `packages/weapp-vite/src/wxs/*`                                    | AST/扫描/输出逻辑               |
| Wevu 运行时能力        | `packages/wevu/src/index.ts`                             | `packages/wevu/src/runtime/*`                                      | runtime API / store / scheduler |
| Wevu 编译结果不对      | `packages/wevu-compiler/src/index.ts`                    | `packages/wevu-compiler/src/plugins/vue/*`                         | template/script/style transform |
| Volar 提示/Schema 问题 | `packages/volar/src/index.ts`                            | `@weapp-core/schematics/src/*`                                     | custom block 嵌入与 schema 注入 |
| 脚手架交互流程调整     | `packages/create-weapp-vite/src/cli.ts`                  | `packages/create-weapp-vite/src/createProject.ts`                  | 问答流程、模板选择              |
| 新建项目依赖版本不对   | `packages/create-weapp-vite/src/createProject.ts`        | `templates/*/package.json`                                         | 写入 `weapp-vite` / `wevu` 版本 |
| 初始化配置文件逻辑     | `@weapp-core/init/src/index.ts`                          | `@weapp-core/init/src/*`                                           | project/package/ts/vite 初始化  |
| 微信 IDE 命令不生效    | `packages/weapp-ide-cli/src/cli/run.ts`                  | `packages/weapp-ide-cli/src/cli/resolver.ts`                       | CLI 路径探测、argv 转换         |

## 4. 组合需求怎么拆（实战模板）

## 4.1 “新增一个 CLI 参数，并影响构建行为”

1. 在 `packages/weapp-vite/src/cli/commands/build.ts` 增加 `.option()` 与读取逻辑。
2. 将参数传给 `buildService.build(options)`（必要时扩展 `BuildOptions`）。
3. 在 `packages/weapp-vite/src/runtime/buildPlugin/service.ts` 实施行为。
4. 若属于配置能力，补到 `runtime/config/*`，避免 CLI-only 硬编码。

## 4.2 “新增一个 weapp 配置项”

1. 扩展 `packages/weapp-vite/src/config.ts` 对外类型。
2. 在 `packages/weapp-vite/src/runtime/config/internal/loadConfig.ts` 完成读取/默认值/合法性。
3. 在 `packages/weapp-vite/src/runtime/config/internal/merge/*` 处理并入 Vite config。
4. 在使用侧（如 build/plugin/service）消费该配置。

## 4.3 “改分包产物策略（重复依赖、共享 chunk）”

1. 先看 `packages/weapp-vite/src/runtime/sharedBuildConfig.ts`。
2. 再追 `packages/weapp-vite/src/runtime/chunkStrategy/*`。
3. 最后回看 `scanPlugin` 的分包识别输入是否正确。

## 4.4 “Wevu 编译输出有偏差（模板/脚本）”

1. 入口确认：`packages/wevu-compiler/src/index.ts` 导出的 API 是否是调用路径。
2. 模板问题：`plugins/vue/compiler/template/*`。
3. script/setup 宏问题：`plugins/vue/transform/*`。
4. 如涉及 weapp-vite 集成，再看 `packages/weapp-vite/src/plugins/wevu*`。

## 5. 改动前检查清单（避免漏改）

- 是否同时影响 `apps/*` 示例（至少选一个最接近场景验证）？
- 是否同时影响 `templates/*`（尤其是 CLI/配置默认值变化）？
- 若改了 `weapp-vite` 或 `templates/*`，是否需要同步考虑 `create-weapp-vite` 版本联动？
- 是否影响 `website` 文档示例（配置项/命令名变更时）？
- 是否需要补或更新对应单测（包内 `test` 或 `*.test.ts`）？

## 6. 常用入口索引（按目录）

- `packages/weapp-vite/src/cli/`：命令注册与参数解析
- `packages/weapp-vite/src/runtime/`：构建与运行时服务核心
- `packages/weapp-vite/src/plugins/`：Vite 插件拼装层
- `packages/wevu-compiler/src/plugins/vue/`：Vue -> 小程序编译内核
- `packages/create-weapp-vite/src/`：脚手架入口与模板拷贝逻辑
- `packages/weapp-ide-cli/src/cli/`：微信 IDE CLI 兼容层
- `@weapp-core/init/src/`：初始化配置基建
- `templates/*`：脚手架模板源

---

建议工作流：先读 `docs/monorepo-architecture-map.md`，再按本指南定位到首查文件，最后再进入具体实现目录深挖。
