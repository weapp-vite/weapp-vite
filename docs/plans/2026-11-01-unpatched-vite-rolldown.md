# 在官方 Vite/Rolldown 上修复产品路径

## 范围与交付状态

候选使用官方 Vite 8.3.5、Rolldown 1.2.16，删除两份工作区补丁及其登记，锁文件由 pnpm 重新生成。Chokidar、Vitest、plugin-vue 三份补丁保持不变。

本候选已创建草稿 PR #1294 持续验证。正常推送被原生 pre-push 的 Vite 契约失败拦截后，用户明确授权本 PR 在该已确认上游阻塞下推送候选和后续修复；不将例外记为本地门禁通过。全部远端 CI、原生审批、原始失败断言和资源门限保持不变，当前不能视为通过发布、完整资源或真实 IDE runtime 验收。

## 产品实现

`packages/weapp-vite/src/plugins/packageImports` 提供内部 pre resolver，自动接入小程序主构建、独立分包、worker 和 Web。先通过公开 `this.resolve` 委派完整请求，保留用户 resolver、external、blocked 映射及原始错误。仅当 imports 的通配符替换结果符合已知 query/hash 错位，且清理后的委派结果确认同一文件时，保留解析元数据并拼回后缀。`resolve.exports` 是发布包的显式依赖。

包元数据缓存按宿主和环境独立持有；配置解析、受监看的 package.json 边界变化及关闭均失效。异步读取按版本结算，失效前开始的读取不能重新填入旧缓存。Vite 内部 CSS resolver、优化器扫描及内部 `createResolver` 没有因此被替换。

公开 API 不提供解析结果的 owner；如果自定义 resolver 故意返回与原生错位路径完全相同的结果，无法仅凭公开返回值区分。兼容插件通过后缀与文件身份核对限制改写范围。

兼容范围是已识别的通配符后缀错位。完整请求已经抛错时保留原错误；目录段通配符等使原结果落到另一文件的情况不会被强制改写。因此这不是 Vite 内部所有 imports 解析路径的替代实现。

classic 多轮构建以前复用自有 object hook，原版 Vite 的包装器会由该对象保留旧环境。内部工厂显式登记自有插件；`createSnapshotBuildConfig` 为每代创建独立插件及 hook 容器，保留共享闭包、api、元数据值和原始调用 this。第三方插件对象及 worker 插件工厂保持原身份和既有元数据广播。

可选 compiler provider 关闭后清除 config/native context 引用；重复和并发关闭等待对应资源完成。清理期间仍允许控制器使用其上下文。现有 CompilerSession、generation watcher 的关闭/重启等待机制保留；没有新增依赖私有字段访问、fork、运行时依赖改写、独立编译进程或手写 bundle。

多 provider 的终态清理等待全部 controller 收敛，单项 close/dispose 失败不再跳过其余资源，所有错误均保留。初始化部分成功后其他工厂失败，或最终名称校验失败时，也会等待并释放本轮已返回的 controller；失败初始化不注册 HMR。普通构建 hook 保留现有失败传播行为。

同一 CLI 上下文配置重启时，HMR host 可能跨代继续存在。compiler provider 现在保存各自注册的释放句柄，在终态 dispose 的 finally 中注销；删除、改名或不支持 HMR 的旧 provider 不再残留。注册使用独立 token，旧代较晚结束也不能删除新代同名 provider，释放闭包不捕获旧回调。普通构建快照仍由 watcher lease 延后清理，不会提前注销活跃 provider。

`compilerPlugin/index.ts` 已超过 300 行。独立的 controller 初始化与清理已提取至 `compilerPlugin/lifecycle.ts`，其余可变上下文和关闭状态保留同一闭包，避免扩大生命周期所有权变更。新增解析和实例隔离模块均拆为小文件。

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

PR CI 的 legacy 和 optimized-v2 均执行三种宿主的 imports 消费场景，wv 强制运行 headless。v2 在原有 32 项上增加三项，完整聚合必须收到 35 项成功证据；原始来源记录、摘要及各执行阶段同时核对，首次构建前保存的来源记录不能冒充完整成功。仅修改 `e2e/consumers` 时也会选中该消费检查。

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

合并主线 `33ca1b4b00` 后，受影响包及新增工具依赖已重建，owning package 的 typecheck、test:types、15 文件 121 项定向回归通过；CI 调度和证据校验的 126 项单测及路由检查通过。原生 pre-commit、commit-msg、相关 ESLint 与 diff 格式检查通过。相对该主线，依赖锁的 2976 项原有 package resolution 不变，仅新增显式 resolver 依赖，其余三份补丁的 hash 不变。先前的 4 文件 22 项集成断言及契约入口 3 项测试保留原通过证据。

正常推送的 pre-push 在独立冻结候选快照中实际执行，lint、全部构建层、产品相邻单测和包级 typecheck 通过。工具测试为 57 文件 784 项通过、1 文件 1 项失败：官方 Vite 的 hook 包装器和 owner 在 GC 后仍存活，违反现有释放断言。该契约直接提取依赖内部函数，不加载 weapp-vite，不能通过产品代码修复。推送退出 1，失败回执未复用为成功。

后续异常清理回归先复现 5 项失败，修复后 compilerPlugin 目录 6 文件 46 项通过；包级 typecheck、build 及新 dist 的独立 wv npm 消费验证通过。该消费者再次核验官方依赖内容，并通过构建、开发更新、配置重启、Web 和两个 headless 页面检查点。

HMR provider 跨代注册回归先复现 7 项失败，修复后共享 host 与 compilerPlugin 的 10 文件 72 项测试通过，覆盖删除、改名、legacy provider 移除、dispose 失败、旧代迟到清理和 watcher lease。共享 HMR 包补充公开返回类型断言，并登记 patch 发布。HMR 与 weapp-vite 的 build、typecheck、test:types 均通过；新 dist 的独立 npm wv 消费者再次通过官方依赖核验、构建、开发更新、配置重启、Web 和两个 headless 页面检查点。该消费者证明发布产物没有引入已有主路径回归，跨代注册本身由上述定向契约覆盖。

合并主线后的独立 npm `wv` 消费者通过新 CI 入口实际执行，主包、独立分包、worker、Web 构建、开发源码更新、package imports 映射变化及配置重启通过。headless runtime 的主包与独立分包两个检查点通过。该安装的 Vite 8.3.5 共 17 份 JS/JSON、Rolldown 1.2.16 共 32 份 JS/JSON 与官方 npm 档案逐字节一致，integrity 校验通过，两者均未应用补丁。

合并前候选的普通 Vite 宿主独立 npm 消费者通过相同构建、开发更新、配置重启及 Web 验证；其 Vite/Rolldown 官方档案核验通过。Vite+ 先前使用官方 `@voidzero-dev/vite-plus-core@1.0.0`，其 70 份 JS/JSON 与官方档案一致，内置 Vite 8.3.1、Rolldown 1.2.11。该宿主首次构建因精确键 `#exact?raw` 被按 `#exact` 查找而失败；后续开发更新和配置重启未执行，失败安装及配置已保留。最新主线配对版本为 1.2.0，其内置 Vite 8.3.4、Rolldown 1.2.13；合并后消费者在 npm install 阶段因网络 ETIMEDOUT 退出，未进入构建，不记为产品通过或失败。官方 core 1.2.0 源码仍有相同精确键截断，但该观察不能代替运行验证。安装中独立存在的 Rolldown 1.2.16 不代表 Vite+ 使用它，也不将 core alias 称为普通 Vite 8.3.5。

PR 首轮 CI 中普通 Vite 和 wv 的独立 imports 消费者通过。Vite+ 消费者完成安装并核对 core 1.2.0 的 65 份 JS/JSON 与官方档案一致后，在主包、独立分包首次构建均复现 `Missing "#exact" specifier`。本轮保留原始错误，后续阶段未执行。该结果补足了先前仅有源码观察、安装超时的证据边界。

PR 第二轮 CI（run `41312400012`）完整结束，171 项成功、72 项按既有条件跳过、9 项失败。发布策略检查已通过；源码守卫排除测试 fixture 后，coverage 第三分片只剩 4 项原生 Vite polling 失败。其余失败为 4 个平台/Node 组合的 Vite hook 释放契约、第一分片的 missing-env ready、第二分片的 hook 释放和 2 项 Web polling、Vite+ 精确键解析，以及按原规则拒绝失败分片的 coverage 汇总。没有降低断言或 coverage 阈值。

Windows 浏览器首轮在握手阶段超时，尚未执行测试；第二轮仅增加启动及请求失败诊断，完整通过 98 个文件、218 项测试，并记录浏览器正常退出和临时目录清理。其他两个平台也通过。首次超时未复现，诊断开关不能视为根因修复；保留原超时、完整测试范围及首次失败日志。普通 Vite、wv 的独立 imports 消费者第二轮再次通过，Vite+ 保留相同首次构建错误。

按 [Vite+ 官方配置说明](https://viteplus.dev/guide/local-cli)及[升级说明](https://viteplus.dev/guide/upgrade-project)，`vite` override 指向与 launcher 同版本的 core alias，Vitest 也固定到配套版本。原消费者已经配置该 alias，但脚手架与消费者仍固定 1.2.0。现已同步至官方 Vite+/core 1.4.0、Vitest 5.0.5，并为消费者补齐 Vitest override。core 无运行时 Vite 子依赖，Vite 源码直接打入其发布包，不能通过子依赖 override 单独替换；`vp` 也会校验 core 包名和与 launcher 一致的版本。

新版独立 npm 消费者已通过主包、独立分包、worker、精确 query 键、开发更新、imports 配置重启和 Web 构建。core 1.4.0 的 66 份 JS/JSON 与官方档案一致，未应用补丁；实际内置 Vite 8.3.5、Rolldown 1.2.15。另装的官方 Rolldown 1.2.16 也完成 32 份文件核验，但它不是该 Vite+ 宿主的内置引擎。原 core 1.2.0 的精确键失败保留为历史证据，新配对已不受此阻塞。脚手架配对 25 项测试、lint、typecheck、build、test:types 通过；锁文件没有新增、删除或改动 package resolution，其余三份补丁 hash 不变。

第三轮远端检查完整结束：169 成功、72 按既有条件跳过、11 失败。补齐全部原始失败日志后，发现 HMR provider 注销使快照在原生构建关闭后查询到空注册表，遗漏旧 provider 的能力拒绝，并影响启动回退的两项相邻用例。快照现改为在本轮 `generateBundle` 捕获能力，在关闭完成后保留原 fallback；新增删除或同名替换 provider 后的恢复回归。修复前 3 项失败，修复后相关 4 文件 71 项通过。另一个 macOS miniapp 分片实际测试通过，失败发生在 timing artifact 的 `FinalizeArtifact ETIMEDOUT`，未将其归为产品断言失败。

真实 Stable DevTools 2.02.2608080、基础库 3.17.2 已运行同一独立消费者并采集两个页面检查点，但严格 suite 因 5 次 `SystemError -80002 / webapi_getwxaasyncsecinfo:fail` 失败；随后关窗缺少完整原生销毁证据，清理门禁也失败。没有修改错误门禁、重复导航或重启重试来换取通过。

官方退出后，通过公开的精确租约恢复和 installation-exit 领域接口再次核验安装身份、进程及登记端口已退出，保留原始错误和窗口记录，追加独立恢复证据。两级命令 scope 已完成，机器租约已释放；该任务的 bridge wrapper 已封存后按精确目录身份移除。资源收尾成功没有改变原验收失败结果。最终真实 runtime 验收与完整资源验收仍未完成。

## 已确认的未解决项

| 契约 | 官方依赖结果 |
| --- | --- |
| Vite hook 包装器释放 | 原始 object hook 仍持有 wrapper 和 owner；产品只隔离自有 hook |
| Vite 原生 imports resolver | 直接调用仍把 `part?raw` 替换为 `part?raw.js`；产品公开插件路径已覆盖 |
| Vite optimizer close | 提取测试首先失败于返回 Promise 身份不同；不足以证明公开资源关闭缺陷，后置断言未执行 |
| Vite optimizer cancellation | 测试注入异步 cancel，但当前真实 cancel 仅同步设置标记；不能据此认定真实 native cancel 未完成 |
| Vite server scan cancellation | 公开 API 复现关闭完成时仍遗留本轮临时优化目录；尚未证明持续积累或关闭后仍写入 |
| Vite 内置 polling watcher | ready 后立即保存未收到更新；多 owner 测试在首次更新处失败，后续关闭归属断言尚未执行 |
| Rolldown bundle retention | 三轮构建关闭并 GC 后仍保留 input options |
| Rolldown watch retention | 两次输出正确更新，但关闭并 GC 后 input/output/logger owner 仍存活 |

同一原版依赖下，三轮 ES/CJS/ES 构建的输出在修改前后均正确；隔离自有容器前后，关闭并强制 GC 后的三个 Vite environment 仍存活。这说明自有 hook 容器隔离没有消除 Vite 内部 resolver 等其他闭包引用，不能据此宣称整体内存问题已解决。

既有完整资源入口继续要求 512 SFC、14 轮、干净候选及原有 RSS/heap/resource 门限；没有降采样或改阈值。候选已提交，但上游依赖门禁仍失败；不将局部诊断替代该正式验收，也不为运行它而绕过 `--require-clean`。

实施记录和原始日志位于本任务 `.tmp/current-run/unpatched-vite-rolldown/`。最终验证状态以该索引和实际退出码为准。
