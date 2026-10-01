# 独立发布包消费与按能力加载

对应 #1131 及 #1142 引用的 #1065 安装/加载闭包验收。本批沿用已有 `verify-vite-host-install.mjs`，不创建第二套安装器，也不发布 npm 包。

## 验收边界

候选包先完成构建，递归打包运行时 workspace 闭包，再安装到仓库外的 private 临时消费者。安装保留 engine、peer 和脚本检查；候选来源通过 package-lock 验证，运行时加载探针拒绝解析到消费者 node_modules 以外的源码。npm 的跨平台 lockfile 候选可能未实际落盘，报告保留 `installed: false` 和已知平台元数据，不将其自动归类为通过或失败；必需入口由 exports、类型、构建及启动共同验收。

原有原生/SFC、prepare、公开类型、classic/stateful 消费验证保留。新增 Tailwind 生产构建和 classic/stateful 工具类更新恢复，读取真实 WXSS 导入图，不固定声明所属 chunk。最低 Node 与当前 LTS 的三系统矩阵也执行 Web 生产浏览器交互及开发模板更新。

所有检查仍全局串行。脚本的 Web/启动验证属于 E2E，必须先检查其他任务的运行状态。

## 证据与负向控制

```sh
pnpm exec turbo run build --filter=weapp-vite... --filter=rolldown-require...
node packages/weapp-vite/scripts/consumerTarballs.mjs .cache/consumer-tarballs
node packages/weapp-vite/scripts/verify-vite-host-install.mjs wv
```

环境变量：

- `WEAPP_VITE_CONSUMER_TARBALLS`：消费预先打好的候选清单，便于构建后切换最低 Node。
- `WEAPP_VITE_CONSUMER_WEB=1`：追加 Web 浏览器验收。
- `WEAPP_VITE_CONSUMER_EVIDENCE`：保存 JSON 安装与启动样本；矩阵以 artifact 保留。
- `WEAPP_VITE_CONSUMER_KEEP=1`：保留本次创建的临时消费者供失败诊断，默认清理。只对脚本创建的隔离项目使用，不指向业务目录。

验收遍历候选的 exports、类型、bin 和 main 实际目标；通配导出仅检查其匹配的文件。负向控制在本次临时安装中破坏根 exports、移走 CLI 产物，确认验证与真实命令均失败后恢复。另有单测覆盖缺失声明、越界导出及 workspace 目录链接污染。

## 安装与启动的不同口径

- 安装：npm 命令墙钟时间、实际文件逻辑字节、文件数、链接数和包版本列表。逻辑字节不等于下载压缩量、磁盘块或运行时内存。网络与缓存状态影响安装耗时。
- 启动：五次全新进程 `wv --help` 的无探针墙钟样本，文件系统缓存未主动清理，因此不是冷盘基准。
- 加载：额外一次带同步模块 hook 的运行，记录模块文件、包归属、文件字节、最终 RSS 和进程峰值 RSS。该次有探针开销，不能与无探针时序混算，也不代表 dev/build 的峰值。

Web 插件只在启用 Web 时导入；Tailwind 的扫描、批次准备及 HMR 来源处理按实际根加载引擎；高级 tsconfig 对象选项才加载 `vite-tsconfig-paths`。关闭能力时不会加载这些适配，但其依赖仍随发布包安装，本批没有宣称减少安装闭包。

这不解决 `tsconfck` 的 TypeScript 6 peer 声明问题；#1132 的消费端依赖兼容与继承路径验证仍需单独完成。

## 当前验证状态

定向源码回归 74 项通过；发布完整性及污染负向单测 12 项通过；weapp-vite 与 Tailwind 包 typecheck、weapp-vite 公开类型检查通过。独立安装已验证 27 个候选包公开目标及两项真实入口破坏负向控制。

本机初步加载观测中，CLI 模块数量从 1329 到 956，修改后未加载 Web 插件、Tailwind 引擎、vite-tsconfig-paths 或 tsconfck。依赖安装图及机器负载存在差异，耗时样本有明显波动，因此当前不声称提速比例、内存节省比例或安装缩包收益。最终结论仍以同输入实测、当前候选 CI 及所要求运行时验收为准。

跨平台最低版本、真实 IDE 及总汇验收未完成，本文件不作为关闭 issue 的依据。
