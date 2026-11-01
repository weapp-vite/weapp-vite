# 在官方 Vite/Rolldown 上修复产品路径

## 范围与交付状态

候选使用官方 Vite 8.3.5、Rolldown 1.2.16，删除两份工作区补丁及其登记，锁文件由 pnpm 重新生成。Chokidar、Vitest、plugin-vue 三份补丁保持不变。

本候选进入 PR 持续验证。当前上游依赖契约仍失败，不能视为通过发布、完整资源或真实 IDE runtime 验收；原始失败断言和资源门限保持不变。

## 产品实现

`packages/weapp-vite/src/plugins/packageImports` 提供内部 pre resolver，自动接入小程序主构建、独立分包、worker 和 Web。先通过公开 `this.resolve` 委派完整请求，保留用户 resolver、external、blocked 映射及原始错误。仅当 imports 的通配符替换结果符合已知 query/hash 错位，且清理后的委派结果确认同一文件时，保留解析元数据并拼回后缀。`resolve.exports` 是发布包的显式依赖。

包元数据缓存按宿主和环境独立持有；配置解析、受监看的 package.json 边界变化及关闭均失效。异步读取按版本结算，失效前开始的读取不能重新填入旧缓存。Vite 内部 CSS resolver、优化器扫描及内部 `createResolver` 没有因此被替换。

公开 API 不提供解析结果的 owner；如果自定义 resolver 故意返回与原生错位路径完全相同的结果，无法仅凭公开返回值区分。兼容插件通过后缀与文件身份核对限制改写范围。

兼容范围是已识别的通配符后缀错位。完整请求已经抛错时保留原错误；目录段通配符等使原结果落到另一文件的情况不会被强制改写。因此这不是 Vite 内部所有 imports 解析路径的替代实现。

classic 多轮构建以前复用自有 object hook，原版 Vite 的包装器会由该对象保留旧环境。内部工厂显式登记自有插件；`createSnapshotBuildConfig` 为每代创建独立插件及 hook 容器，保留共享闭包、api、元数据值和原始调用 this。第三方插件对象及 worker 插件工厂保持原身份和既有元数据广播。

可选 compiler provider 关闭后清除 config/native context 引用；重复和并发关闭等待对应资源完成。清理期间仍允许控制器使用其上下文。现有 CompilerSession、generation watcher 的关闭/重启等待机制保留；没有新增依赖私有字段访问、fork、运行时依赖改写、独立编译进程或手写 bundle。

`compilerPlugin/index.ts` 已超过 300 行。本次只调整现有闭包的终态清理，保留其单一所有者；拆分会扩大生命周期变更，暂不拆分。新增解析和实例隔离模块均拆为小文件。

## 回归入口

先构建依赖和 owning package，确保消费端使用当前 dist：

```sh
pnpm --filter 'weapp-vite^...' build
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite build
pnpm --filter weapp-vite test:types
pnpm exec vitest run packages/weapp-vite/src/plugins/packageImports packages/weapp-vite/src/plugins/ownedInstances.test.ts packages/weapp-vite/src/plugins/compilerPlugin packages/weapp-vite/src/runtime/buildPlugin/snapshotConfig.test.ts
```

独立 npm tarball 消费入口沿用已有打包闭包和机器租约。新入口不会把内部兼容插件写进消费者配置，并清除继承的 NODE_OPTIONS/NODE_PATH；保留机器租约变量。消费安装使用严格 peer 校验，并将安装后的 JS/JSON 文件逐字节与锁文件指向的官方 npm 档案比较，同时记录实际引擎入口、版本、integrity 和内容摘要。

```sh
node --import tsx e2e/scripts/run-e2e-commands.ts node packages/weapp-vite/scripts/consumerImports/install.mjs vite
node --import tsx e2e/scripts/run-e2e-commands.ts node packages/weapp-vite/scripts/consumerImports/install.mjs wv headless
node --import tsx e2e/scripts/run-e2e-commands.ts node packages/weapp-vite/scripts/consumerImports/install.mjs vite-plus
```

可选第三个参数为 `headless`、`devtools` 或 `both`。runtime 使用同一独立消费者的已构建产物，核对主包、独立分包的页面 data、DOM 及必需文件，再验证 Web 构建。真实 IDE 仍须满足既有安装、机器租约、窗口归属和验收条件。此独立消费 case 位于 `e2e/consumers`，由显式 target 选择，普通 IDE suite 不会增加缺少消费者输入的 task。

整条消费验证成功后才自动移除临时项目。失败默认保留目录，以便在 IDE 或进程收尾未完成时继续精确恢复；`WEAPP_VITE_CONSUMER_KEEP=1` 也可保留成功安装。

依赖契约保留原行为断言和门限。Vite resolver harness 改为提取原版已有方法，不再依赖补丁新增的函数。`--case` 只用于逐组诊断；不带参数仍为完整门禁，筛选结果不能算全量成功。

```sh
node --import tsx e2e/scripts/run-e2e-commands.ts node --expose-gc --import tsx scripts/dependencyContracts/vite/run.mjs
node --expose-gc --import tsx scripts/dependencyContracts/rolldown/run.mjs --report .tmp/rolldown-contracts.json
```

## 本地验证结果

最终产品源码已经重建，owning package 的 typecheck、test:types、14 文件 114 项定向回归、4 文件 22 项集成断言及契约入口的 3 项测试通过。相关 ESLint 与 diff 格式检查通过。依赖锁核对确认 2914 项原有 package resolution 不变，其余三份补丁的 hash 不变。

最终候选的独立 npm `wv` 消费者通过主包、独立分包、worker、Web 构建，开发源码更新、package imports 映射变化及配置重启。headless runtime 的主包与独立分包两个检查点通过。该安装的 Vite 8.3.5 共 17 份 JS/JSON、Rolldown 1.2.16 共 32 份 JS/JSON 与官方 npm 档案逐字节一致，integrity 校验通过，两者均未应用补丁。

最终候选的普通 Vite 宿主独立 npm 消费者也通过相同构建、开发更新、配置重启及 Web 验证；其 Vite/Rolldown 官方档案核验通过。Vite+ 保留仓库批准的 launcher/core 配对与其自身引擎入口：实际为官方 `@voidzero-dev/vite-plus-core@1.0.0`，70 份 JS/JSON 与官方档案一致；其 `bundledVersions` 为 Vite 8.3.1、Rolldown 1.2.11，宿主使用该内置引擎。安装中独立存在的 Rolldown 1.2.16 不代表 Vite+ 使用它，也不将该 alias 称为 Vite 8.3.5。Vite+ 首次构建即因 core 将精确键 `#exact?raw` 按 `#exact` 查找而失败；插件保留委托解析的原始错误，后续开发更新和配置重启未执行。失败安装及复现配置已保留，没有换宿主绕过。

真实 Stable DevTools 2.02.2608080、基础库 3.17.2 已运行同一独立消费者并采集两个页面检查点，但严格 suite 因 5 次 `SystemError -80002 / webapi_getwxaasyncsecinfo:fail` 失败；随后关窗缺少完整原生销毁证据，清理门禁也失败。没有修改错误门禁、重复导航或重启重试来换取通过。

官方退出后，通过公开的精确租约恢复和 installation-exit 领域接口再次核验安装身份、进程及登记端口已退出，保留原始错误和窗口记录，追加独立恢复证据。两级命令 scope 已完成，机器租约已释放；该任务的 bridge wrapper 已封存后按精确目录身份移除。资源收尾成功没有改变原验收失败结果。最终真实 runtime 验收与完整资源验收仍未完成。

## 已确认的未解决项

| 契约 | 官方依赖结果 |
| --- | --- |
| Vite hook 包装器释放 | 原始 object hook 仍持有 wrapper 和 owner；产品只隔离自有 hook |
| Vite 原生 imports resolver | 直接调用仍把 `part?raw` 替换为 `part?raw.js`；产品公开插件路径已覆盖 |
| Vite+ core 精确 query 键 | 官方 core 在首次构建中查找 `#exact` 而不是精确键 `#exact?raw`；保留原错误，消费门禁失败 |
| Vite optimizer close | 重复关闭未共享资源完成边界 |
| Vite optimizer cancellation | 取消未等待 native cancel 完成 |
| Vite server scan cancellation | 关闭后仍出现新的临时优化目录 |
| Vite 内置 polling watcher | 多 owner 的监听更新/释放契约失败 |
| Rolldown bundle retention | 三轮构建关闭并 GC 后仍保留 input options |
| Rolldown watch retention | 两次输出正确更新，但关闭并 GC 后 input/output/logger owner 仍存活 |

同一原版依赖下，三轮 ES/CJS/ES 构建的输出在修改前后均正确；隔离自有容器前后，关闭并强制 GC 后的三个 Vite environment 仍存活。这说明自有 hook 容器隔离没有消除 Vite 内部 resolver 等其他闭包引用，不能据此宣称整体内存问题已解决。

既有完整资源入口继续要求 512 SFC、14 轮、干净候选及原有 RSS/heap/resource 门限；没有降采样或改阈值。本地候选尚有未提交变更且上游依赖门禁失败，不将局部诊断替代该正式验收，也不为运行它而绕过 `--require-clean`。

实施记录和原始日志位于本任务 `.tmp/current-run/unpatched-vite-rolldown/`。最终验证状态以该索引和实际退出码为准。
