# worker 输入监听与原生构建阶段

## 失败证据

Vite Host Consumer 的 macOS watch 验证中，新增 worker 导入后，在 `writeBundle` 屏障内删除 `app.json.workers`，输出仍保留 worker。原生日志没有这次 app 配置的文件事件；相同提交的 Linux 和 Windows 用例通过。本机原用例连续七次通过，说明事件丢失依赖时序，不能据此撤销远端失败。

worker 原来在 `generateBundle` 才完成子构建并登记新增输入。Rolldown 1.2.12 会在写出结束后登记渲染阶段新增的路径；macOS FSEvents 为此停止当前事件流，再从当前时刻启动，尚未递送的保存事件可能丢失。新增回归在主图扫描完成时记录子构建已经发现的输入，旧实现确定性地缺少本轮新增依赖。该检查与原有 publication 屏障及输出删除断言一起保留。

## 实现选择

采用与已有 npm 输入修复一致的阶段划分：`buildStart` 在 app 扫描服务之后串行准备 worker，收集成功或失败时发现的输入；`generateBundle` 只发射当轮内存资产；最终写出和已归属资产的删除继续由原发布流程负责。

另一种做法是只监听 worker 根目录并省去子文件登记，但这无法覆盖根目录外的导入。再增加文件 watcher 会形成重复的事件所有权，因此没有采用。

worker 准备失败仍在原来的 `generateBundle` 阶段报告。若提前从 `buildStart` 抛出，主图还未扫描，首次失败后通过修改 app 配置移除 worker 的恢复路径可能失去监听。每轮清空准备结果与待发布清单；失败轮不发射旧资产，也不清理上一轮已发布资产。`serve` 和 `bundledDev` 保留各自的 worker 调度路径。

## 验证

覆盖输入发现阶段、发布期间配置修改、首次语法错误后移除 worker、失败后的恢复与产物归属。运行包级类型、构建、lint 和相邻 watch 回归，重建后验证下游 worker 场景。最终验收继续要求同一提交的完整回归与远端三系统矩阵；这些局部结果不能代替真实 IDE 验收。
