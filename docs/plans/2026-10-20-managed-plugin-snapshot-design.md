# 受管插件快照的资源生命周期

默认 `wv dev -o` 继续通过官方 CLI 打开原项目 P。显式 automator 策略可将宿主产物提升为布局快照 W；本次只修复受管 W 的资源所有权，不改普通冷 CLI 合同。

现有 resolver 在窗口预算前覆盖确定性的共享 W，随后丢弃 cleanup callback。CLI 建立连接后仅 disconnect，内存 callback 不能支撑父进程恢复。调整测试断言、在 finally 猜路径删除或将默认 CLI 改为 W 都不能消除这个根因。

受管入口先只读解析布局，在现有 journal 根锁内取得 owner 与窗口预算，再独占创建 `journal/snapshots/<owner UUID>`。记录保存 source P、generation、创建 token、目录身份和派发阶段；已有 target/port/owner 记录继续承担安装、连接与原生窗口身份。普通非受管 resolver 保留原有行为。布局转换共用原函数，不添加 watcher 或另一套关窗协议。

快照创建采用独立 generation，清理复用现有 close 的并发串行和失败可重试语义。disconnect 只结束连接，W 仍由 journal 持有。显式 close 先通过原有窗口与端口销毁门禁，再验证 W 路径、目录身份及创建 marker 后删除。窗口状态和快照状态分别持久保存，删除失败不能撤销窗口销毁证据或再次发送关窗。

未派发启动的半成品可按创建 provenance 回收；派发后回执未知时保留 W、journal 和错误。`agentStart.onBeforeDispatch` 在参数、目标、宿主与取消预检完成后、执行命令前登记意图，预检失败不标记派发；钩子开始后进入保守的派发意图边界，即使随后取消阻止了命令执行，也不撤销 journal 中的标记。若官方返回 borrowed，任务没有窗口关闭权，也不能删除仍可能被使用的 W；仅现有显式安装退出恢复在证明安装、owner 和端口全部退出后完成回收。合法系统路径别名与快照目录替换分别判断，拒绝 symlink、marker 或目录身份漂移。无法持久保存最小创建身份的 I/O 故障保留阻塞证据，不擅自删除未知目录。

统一的 fully-released 判据要求窗口为 released 且快照 removed。预算、项目 mutation、新任务预检、后代 scope 完成、测试 fixture 销毁和资源报告均采用此判据。原有窗口数、端口与原生销毁证据仍按窗口状态统计。报告保留快照清理状态，并散列创建 token。

验证范围包括预算拒绝前不触盘、创建半成品、未知回执、borrowed、父进程恢复、窗口释放后删除失败重试、并发关闭、目录/marker 替换、合法路径别名、显式安装退出及报告脱敏。公共 journal/intent 类型同步 tsd，正常重建包产物后再验证下游 CLI 与真实 IDE。

后续插件 E2E 保留默认 CLI P，独立验收显式 automator W，并绑定实际 journal owner；此提交不调整模板清单。现有资源报告测试已超过 300 行，暂保留同一 observation fixture 以避免复制宿主证据 setup；后续扩充前应提取共享 fixture。新增生产模块均保持在 300 行以内。既有 `agentStart.test.ts` 超过 300 行，本次沿用集中 mock 的顺序与取消测试 fixture，避免为少量边界用例复制命令/租约 setup。
