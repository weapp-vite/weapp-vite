# 发布包归因与 runtime 验收

`verifyConsumer.ts` 只操作显式标记为可丢弃的独立消费者。省略 runtime 参数保留历史 build-only 行为；原有 `--runtime=headless` 从该消费者安装的 `@mpcore/test` 加载运行时，不回退工作区包。

```sh
node --import tsx scripts/runtime-size/verifyConsumer.ts <consumer> --disposable-consumer --runtime=headless
node --import tsx scripts/runtime-size/verifyConsumer.ts <consumer> --disposable-consumer --runtime=devtools
```

两个 provider 使用相同 minimal/typical 页面源码和消费者自身 CLI 构建。typical 的原生按钮验证 `onLoad` 后 `1 / 2`、点击后 `2 / 4`；minimal 验证实际页面文本。报告记录每场景完整产物哈希，并拒绝 runtime 验收改写构建产物。

DevTools 入口要求通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 显式选择已核实的官方最新 Stable 安装。执行前记录官方来源、查询时间和版本，执行后与报告中的实际 IDE、基础库版本核对；`devtools` 名称本身不证明 Stable 渠道。命令属于全局串行 runtime 验收，运行期间保持设备唤醒。

两个场景的 app/页面产物互斥，因此每次生产重建后连接并刷新同一消费者项目，避免把上一场景缓存当作本次产物。通过 direct bridge 读取消费者 `dist`，不复制或修补 bundle。所有 DOM 查询禁止 AppService fallback，启动至断开连接的错误日志、协议失败、登录失败和清理失败均阻断通过；不回退 headless。

入口仅释放自己持有的 automator 连接，恢复本次修改的 private 页面条件与进程环境。IDE 宿主由验收执行者统一管理和收尾，不能据此关闭用户窗口或其他项目。诊断日志保留在消费者的 `runtime-attribution-evidence`，`verification.json` 区分运行通过、环境失败和仍需官方 Stable 渠道证据；未运行或失败不能标记 issue 完成。
