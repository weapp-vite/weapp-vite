# Issue 1082：合并后第一轮诊断

关联 [#1082](https://github.com/weapp-vite/weapp-vite/issues/1082)。产品源码为合并提交 `d657d7b64bf2e5fb367862377255d513dab0ec07`；本轮只有证据归档，没有产品修复。下面两种诊断均不能替代三平台固定批次验收。

## 原生 classic CPU 诊断

先安装依赖，执行 `pnpm --filter 'weapp-vite...' build` 重建 CLI 及依赖。确认无活动的 CLI dev、仓库 E2E、automator 或 benchmark 进程后串行运行一次；编辑器测试服务仍存在，本轮不作为正式性能样本。

通过既有 `benchmark-templates-hmr.ts` 运行原生模板的 App JSON、脚本、模板、样式，保留各两次编辑/恢复和现有轮询、稳定等待。设置 `TEMPLATES_HMR_FILTER=weapp-vite-template`、`TEMPLATES_HMR_RUNTIME=classic`、`TEMPLATES_HMR_ITERATIONS=2`、`TEMPLATES_HMR_SAMPLE_MODE=edit-only`、`TEMPLATES_HMR_MAX_SCENARIOS_PER_TEMPLATE=4`，以 `TEMPLATES_HMR_CPU_PROFILE_DIR` 保存 CLI CPU profile。报告由正常 CLI 产物与现有断言生成。

- 4 个场景均完成，模板/场景失败数均为 0。
- 进程退出 1：App JSON 首次编辑 compiler total 为 516.74 ms，超过驱动保留的 500 ms 诊断预算；最大 wall 为 602.36 ms。没有将它改写为通过，也未改预算重跑。
- CPU profile 中 `realpath` 的 self samples 总计约 2026 ms；调用链集中于 `relativeAbsoluteSrcRoot`、协议路径解析以及 `resolveSharedBuildChunkName`。源码中的相对路径计算会重复解析目标、源码根及项目根，值得进一步检查单次构建中的重复工作。
- 此 profile 覆盖启动及整个 dev 会话，包含强制 GC/诊断开销，**不能声称 2026 ms 都是 HMR 成本或回退增量**。没有基线 CPU profile，也未证明这些调用是本 PR 新增。下一步必须把样本对齐到每次更新的阶段，比较调用次数及失效归属，避免缓存破坏符号链接切换、配置重载和目录拓扑。

[CPU profile（脱敏 gzip）](./issue1082-native-diagnostic.cpuprofile.gz) 与 [驱动报告（脱敏 gzip）](./issue1082-native-diagnostic.json.gz) 仅替换本机工作区及用户目录；所有计时、采样、节点及调用关系保留。这些文件不是原始字节副本。原始文件在本地证据目录保留，原始 SHA-256 分别为 `ef9aaaa8b2172f2bdf7b115ac286e076ba1611cb625a438d7eb5819704c981d8` 和 `8a1f14906ea6100f7fda2ac1cc714a5239577c48a72f8fe70c75656db7d446b6`。

## Stateful 混合保存事件复现

在合并后的代码上应用 [期望行为补丁](./issue1082-stateful-reproduction.patch)，执行：

```sh
pnpm exec vitest run --config packages/weapp-vite/vitest.config.ts packages/weapp-vite/src/runtime/statefulHmr/session.snapshots.test.ts -t 'keeps atomic child restoration'
```

结果仍为期望 `true`、实际 `false`。测试只在原子保存前后增加临时文件 create/delete 事件，并把临时文件加入原有 JS patch 文件列表；有效 JS 内容未变。源码将非 JS/Vue 的临时文件请求为 snapshot，再因混合文件列表拒绝安全 patch，进入完整重建分支。此诊断证明分支行为，不能证明 CI 发布超时的完整因果链。

复现后撤销补丁，原始 `session.snapshots.test.ts` 全部 27 例通过。补丁独立作为复现材料提交，不把失败测试加入默认测试集，也不改成断言错误现状的测试。最终修复时需将期望用例正式纳入回归，并补自定义 addWatchFile、compiler、WXML、copy/public、目录增删覆盖。

本轮没有声称修复，不新增 changeset。后续行为修复必须重建 CLI，验证实际混合事件与发布协议，并补 headless/真实 DevTools 场景；不得依靠临时文件名黑名单或文件内容变化替代发布完成。
