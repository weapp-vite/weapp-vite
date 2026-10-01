# 原生 watch 的配置校验快照

完整质量运行 `36818847372` 的 macOS Node 22 job `110238817514` 在非法 worker 配置的产物断言失败。macOS Node 24 job `110245905911` 另有删除 worker 配置后旧产物残留的失败。二者日志保留，不能用定向通过覆盖原始失败。

## 已复现的校验缺口

`WeappBuildSession.validateEntries()` 等待 `scanService.loadAppEntry()`，却丢弃返回的配置，再通过共享 `scanService.workersDir` 校验。真实文件扫描结束后，如果 watcher 调用 `markDirty()`，共享 `appEntry` 会被清空；已扫描配置仍含 `workers`，校验却把它当作没有 worker。

`test/vite-watch-validation.test.ts` 使用真实临时项目与实际配置扫描，仅以两个 Promise 控制扫描完成与校验恢复之间的时序。失效后原实现没有抛错，修复后保留原 `weapp.worker.entry` 错误。不修改文件监听、构建输出或错误断言。

## 实现边界

校验使用本次扫描返回的 AppEntry，共用原 worker 检查逻辑。共享扫描缓存仍可正常失效，不通过锁住 watcher 或重新扫描来隐藏竞态。

这证明并修复了一个配置校验竞态，尚未证明它是上述两条 CI 失败的完整原因。原生 watch 配置错误恢复与 worker 删除测试保持原断言，新增三系统 Watch validation 门禁继续验证。此前一次构建中受控编辑配置、八轮原用例，以及 worker 定向测试均未重现原 CI 产物失败，不能声称原 CI 两项都已解决。

## 验证与依赖

本分支包含 #1151 的实际路由缓存修复，用于避免旧路由删除失败遮挡新的配置问题；该依赖应先独立完成验收并合入 main。修复改变构建行为，提供 weapp-vite 与 create-weapp-vite changeset。源文件均未超过 300 行，不需要拆分。

- 最小复现修复前失败，修复后通过。
- 定向 session、worker 校验、原生 watch、worker build/watch/dev 共 13 项通过。
- 包级 typecheck、官方 test:types 脚本、构建与定向 ESLint 通过。
- 真实打包消费、原生 dev/build-watch/stateful 与严格 headless worker 消息/页面重入用例通过，runtime warning/error/exception 为 0。报告是提交前文件树，不冒充后续提交的精确 HEAD；真实 IDE 最终验收仍待环境恢复。
