# 原生 watch 的配置校验快照

完整质量运行 `36818847372` 的 macOS Node 22 job `110238817514` 在非法 worker 配置的产物断言失败。macOS Node 24 job `110245905911` 另有删除 worker 配置后旧产物残留的失败。二者日志保留，不能用定向通过覆盖原始失败。

## 已复现的校验缺口

`WeappBuildSession.validateEntries()` 等待 `scanService.loadAppEntry()`，却丢弃返回的配置，再通过共享 `scanService.workersDir` 校验。真实文件扫描结束后，如果 watcher 调用 `markDirty()`，共享 `appEntry` 会被清空；已扫描配置仍含 `workers`，校验却把它当作没有 worker。

`test/vite-watch-validation.test.ts` 使用真实临时项目与实际配置扫描，仅以两个 Promise 控制扫描完成与校验恢复之间的时序。失效后原实现没有抛错，修复后保留原 `weapp.worker.entry` 错误。不修改文件监听、构建输出或错误断言。

## 实现边界

校验使用本次扫描返回的 AppEntry，共用原 worker 检查逻辑。共享扫描缓存仍可正常失效，不通过锁住 watcher 或重新扫描来隐藏竞态。

这证明并修复了一个配置校验竞态，尚未证明它是上述两条 CI 失败的完整原因。原生 watch 配置错误恢复与 worker 删除测试保持原断言，新增三系统 Watch validation 门禁继续验证。此前一次构建中受控编辑配置、八轮原用例，以及 worker 定向测试均未重现原 CI 产物失败，不能声称原 CI 两项都已解决。

## 验证与依赖

本分支包含 #1151 的实际路由缓存修复，用于避免旧路由删除失败遮挡新的配置问题；同时合入 #1150 的实际根路径身份修复。两个依赖都应先独立完成验收并合入 main。修复改变构建行为，提供 weapp-vite 与 create-weapp-vite changeset。源文件均未超过 300 行，不需要拆分。

- 最小复现修复前失败，修复后通过。
- 定向 session、worker 校验、原生 watch、worker build/watch/dev 共 13 项通过。
- 包级 typecheck、官方 test:types 脚本、构建与定向 ESLint 通过。
- 真实打包消费、原生 dev/build-watch/stateful 与严格 headless worker 消息/页面重入用例通过，runtime warning/error/exception 为 0。报告是提交前文件树，不冒充后续提交的精确 HEAD；真实 IDE 最终验收仍待环境恢复。

Windows Watch validation 运行 `36828404776`、job `110259187383` 在 classic worker 测试中触发 `src/win/fs-event.c:72` 断言，进程退出码为 `3221226505`；配置快照最小回归本身通过，同运行 macOS 对照 13 项通过。原分支未包含 #1150，现合入其实际提交并保留 Host paths、Native path controls、Route topology 和 Watch validation 全部门禁。新 Windows 结果仍是必需证据，不能以本地 macOS 通过替代。

## 启动校验之后的配置保存

组合提交 `81305d230` 的 Route topology macOS job `110315528587`（运行 `36845801730`）再次失败：非法 worker 配置进入 `app.json`；同运行 Windows job `110315528589` 通过。组合已经包含配置快照修复，因此不能将此前的定向通过当作完整修复。

新的真实 Vite 回归仅用前置 `load` 钩子确定保存时刻：启动扫描与校验完成后、app 逻辑入口收集前，写入真实源配置。原实现构建成功，并由 Vite 输出带非法 `workers` 的 app 资源；没有手写产物、模拟文件系统或主动改变缓存。第一次将保存安排在启动校验函数返回后仍被后续校验捕获，这是通过的对照，不当作失败复现。

入口收集会重新读取配置，启动阶段的有效快照无法保证后来读取的配置也有效。现在在 `collectAppEntries` 对实际读取的 app 配置使用同一 worker 校验，先校验再收集侧文件或更新入口缓存。保留启动校验以尽早报告错误；实际产物的合法性由使用该内容的收集边界保证，不锁住 watcher、不增加轮询、不直接写产物；保持原有命中缓存后跳过路由整理的快路径。

回归覆盖自动路由开/关及字符串/对象两种 worker 配置，并检查真实构建拒绝与非法资源未落盘。该可控时序证明新的发布边界缺口；尚未取得原 CI 自然事件时序，不能宣称已证明全部历史失败的完整因果。原生 watch 的配置恢复、正常 worker 输出和三系统 CI 断言继续保留。
