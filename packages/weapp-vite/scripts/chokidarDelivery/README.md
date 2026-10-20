# Chokidar 发布消费契约

这个入口验证补丁通过真正的 `weapp-vite` tarball 进入普通 npm 消费者。它不构建包，运行前必须先重建候选产物。入口必须借用仓库正式机器租约，不能直接裸跑：

```sh
node --import tsx e2e/scripts/run-e2e-commands.ts node --import tsx packages/weapp-vite/scripts/chokidarDelivery/index.mjs --report .tmp/chokidar-delivery.json
```

默认使用已有产物打包完整 workspace 运行依赖闭包。`--tarballs <directory>` 可读取 `consumer-tarballs.json` 和其中的真实归档，避免重新打包。两条路径都先依据归档中的依赖边与仓库 workspace 名称清单核验完整闭包，缺少任何运行依赖 tarball 时立即失败，禁止从注册表补齐同名 workspace 包。所有候选包通过直接 tarball 依赖安装到仓库外的物理临时目录，使用普通 `npm install --strict-peer-deps`，并通过显式 CLI 参数关闭 legacy peer 与 force，以免继承配置或 Windows 环境变量大小写影响严格策略；不使用 `pnpm.patchedDependencies`、源码链接、loader alias 或调试导出。运行逐字校验安装文件与归档、完整依赖来源、公开 exports 和安装树链接边界，再用消费者自己安装的 TypeScript 在 `strict:true`、`skipLibCheck:false` 下编译公开类型契约及发布声明。

类型编译失败会立即保存编译器退出码与完整输出，随后继续串行执行独立 runtime 契约。`types.status` 与 `acceptance.publicTypesPassed` 保留类型结果，`applicableScenariosPassed` 只反映运行场景；任一类型失败均使总结果保持 `failed`、进程非零退出并保留消费者。取消、报告保存失败或资源清理未确认会停止后续场景。

实际 tarball 中的全部运行时 JS 使用 AST 检查，拒绝对 `chokidar`/`readdirp` 的外部导入，记录文件摘要与导入关系，并检查完整第三方 MIT 文本。动态裸导入及子路径导入的合成反例必须被拒绝。这份导入图不是 Rolldown 的 `chunk.modules` 元数据，也不作为内部 helper 名稳定性的证据。

每个运行场景使用独立 Node worker、独立非 IDE child scope 和全新 fixture。子进程显式去除继承的真实 IDE journal、`NODE_OPTIONS` 和 `NODE_PATH`，原机器能力票据与祖先 scope 保留。监督器记录精确 child PID，仅在其退出、公开 owner 幂等关闭、所有已观测原生句柄收到一次 close 调用和实际 close 事件、fixture 删除及 borrower 释放全部确认后完成 scope。诊断性强制关闭不能产生通过结果；不明清理保留 scope、临时消费者与报告，停止后续场景。不操作微信 IDE、登录、全局缓存或其他进程。

公开运行契约包括：

- `weapp-vite/test` 的 `watchTestArtifact` 接收存在目录的 EPERM 时保留原始 Error 身份。
- Windows 实机的缺失目录注册竞争必须恢复，并通过公开 watcher 真实输出重建目录后的 create/change/delete。其他平台明确记录该案不适用，绝不伪装 `process.platform`。
- 非 Windows 实机缺失目录 EPERM 仍必须按原始 Error 失败。
- 同进程的 `weapp-vite/test` 与 `weapp-vite/vite` 分别取得 owner，精确同一个目录只调用一次原生 `fs.watch`；首个 owner 关闭不释放句柄，幸存者继续实际输出，末个 owner 关闭才产生一次原生 close。另一个独立 worker 反转入口与关闭顺序。Vite 合并 `config` 返回值时忽略 `null`，所以测试专用插件在最后的 `configResolved` 阶段就地设置 `server.watch=null`；Vite 等待该阶段完成后才创建宿主 watcher。最终配置仍须断言为 `null`，以排除 Vite 自身的不同 Chokidar，保留两个公开 owner 的真实共享监听验证。

`--baseline-tarballs <directory>` 接受从未修改的原始源码/产物独立打包的完整归档闭包，不会改写候选或安装后产物。在真正 Windows 上，用同一个正恢复契约验证原始 tarball 按原始注入 EPERM 变红且资源清理完整。未提供时报告 `negativeControl.status=not-run`；Windows 总结果为 `incomplete`，不能作为完整验收。非 Windows 不执行这个 Windows 反例，报告保留未运行状态；本机其他案通过也不能宣称 Windows 恢复或原始反例已经验收。

通过的报告仅代表当前原生操作系统上的适用契约。完整交付仍需真实 Windows worker、未补丁原始归档反例、正式依赖合同与相关 CI。这个入口不采集独立性能样本。

编排层的注入单测只使用假编译器、假 worker 与内存报告，不启动 watcher、机器租约或 IDE。该测试已由包级默认配置的 `weapp-vite-fast` 项目发现，根目录 `pnpm test`、`pnpm test:coverage` 和包级 `pnpm --filter weapp-vite test` 均会执行，现有 CI 的 coverage 入口同步覆盖。仅运行这组 mock 单测时可使用独立配置，避免其他项目的全局准备：

```sh
pnpm exec vitest run -c packages/weapp-vite/scripts/chokidarDelivery/vitest.config.mjs
```
