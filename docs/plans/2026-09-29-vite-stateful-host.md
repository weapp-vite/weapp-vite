# 原生宿主 stateful 开发阶段

## 范围

在已有生产构建、classic 与生产 watch 的基础上，让 `weapp()` 在普通 Vite 与 Vite+ 的 client 环境中安装现有 stateful 编译会话。独立 `wv` 保留自己的服务入口；三者共享编译、快照、补丁和原生输出写出。

本阶段仍只开放微信 TS/Vue 和既有普通分包范围。完整能力对齐由 #1097 继续追踪，React、worker、独立分包、微信插件双产物、lib、多平台、Web、脚手架及测试 artifact 集成不因本阶段完成而标记为已支持。

## 生命周期边界

- 在插件工厂阶段提供固定插件槽，入口集合由启动快照绑定；不通过 `config` 返回值动态注册插件。
- 插件借用宿主 client 环境，不另起 Vite 服务。CLI 创建并拥有自己的服务；两条路径共用适配器和输出协议。
- 初始启动与宿主 `listen()` 共享一次 DevEngine 启动；关闭可取消初始产物等待，且只关闭自身引擎。私有方法仅在仍由本适配器持有时恢复，其他环境不被修改。
- 开发服务器的 close/restart 负责释放会话。原生引擎触发的 `closeBundle` 不反向关闭会话，避免循环等待。
- 入口拓扑变化请求宿主 restart，不进入 CLI 内部重启任务。旧会话退出后才创建新会话，配置文件仍只由宿主加载。
- bundledDev 负责隔离源码更新，保留宿主的配置/环境文件监听。不得沿用私有 CLI 服务的 `hmr: false` 关闭整个宿主配置重启。
- HTTP 服务完成监听后重新发布实际通信端口。middleware mode 支持编译和关闭；消费方仍需自行挂载 HTTP middleware 与配置端口。
- CLI 与插件的快照均复用本次加载的用户配置，在隔离上下文内重新归一化，不重新执行配置文件；CLI 原有双配置合并规则仍在入口加载阶段执行。
- 快照与增量文件继续由原生 emit/write 输出。增量写出与 DevEngine 均加载宿主配套 Rolldown，包含 Vite+ core 子路径。

Skyline 不支持 stateful。当前宿主入口在快照发现 Skyline 或不具备私有 API 能力时明确报错并要求显式选择 classic，避免在已经固定的 stateful 插件链上启动另一种开发模式；独立 CLI 的既有自动降级行为保留。

## 回归与消费

`test/vite-stateful.test.ts` 覆盖 HTTP/middleware 两种启动、首次完整输出、模板更新、入口增删和产物删除、显式重启、配置依赖单次重载、启动失败后重试及 Skyline 明确报错。

适配器单测覆盖重复启动/关闭、待完成首轮发布的取消、两个宿主隔离、client 方法恢复与私有能力失败。沿用 classic 回归和独立 CLI stateful runtime 用例，避免插件接入破坏已有入口。

独立 tarball 消费脚本分别验证 `wv`、`vite` 和 `vite-plus`，严格 peer 安装、真实 exports、宿主/编译器模块身份、测试无副作用、prepare/build/classic、原生生产 watch 与 stateful 引擎/HTTP/模板往返。watch 消费验收等待宿主每轮 `BUNDLE_END` 日志后再进行下一项独立编辑，不能把文件刚出现当作本轮已完成；另有原生 watch 回归在写出期间修改其他入口，验证更新不丢失。

复用 `e2e/ide/stateful-hmr.runtime.test.ts`，通过 `WEAPP_VITE_E2E_COMPILER_HOST=wv|vite|vite-plus` 选择原生命令。同一份 provider-compatible 场景串行在 headless 与真实微信 IDE 上执行；实际样式检查保留在真实 IDE，不把 headless 无法提供布局观察写成通过。

## 文件规模

从既有大文件 `statefulHmr/session.ts` 提取 `hostPlugins.ts`，把插件注册与运行会话分开。`viteAdapter.ts` 仍超过 300 行，当前变更保持私有接口适配和资源所有权集中；不在本阶段混入模块事实索引的独立重构。`buildPlugin/service.ts` 仅补充宿主模式的明确能力边界，沿用已有编排。既有 `snapshotBuild.integration.test.ts` 也超过 300 行，本次复用其共享临时项目 fixture 补双配置复用回归，不复制整套 fixture。

## 已验证结果

- 包级 typecheck、公开类型、构建和定向 stateful 套件（45 文件 / 291 测试）通过；写出期间更新其他入口的独立 watch 回归 1 项通过。
- 普通 Vite 与严格独立安装的 Vite+ 均通过 3 项 headless 与 4 项真实微信 IDE 场景；独立 `wv` 通过同组 3 项 headless 和 4 项真实微信 IDE 场景。样式观察保留在真实 IDE 验收中。
- 后续严格 `wv` 消费发现快照重复执行用户配置，修复后新增双配置归一化回归；相关配置/快照测试共 70 项、服务/宿主测试 86 项通过；适配器生命周期与能力测试 19 项通过。
- 网站构建、changeset 联动检查及定向 ESLint 通过。

这些结果不代表高级目标已开放，也不替代 CI 的跨平台验收。
