# 原生与 Vue 自动路由拓扑验收

当前候选的 classic 原生/Vue 页面新增、删除、恢复产物检查通过，headless 与官方 Stable 各完成 **2/2 用例、4/4 检查点**。两端路由、选择器、数量和文本一致；相关 CI 为 **2/2**，整合单测为 **200/200（10 文件）**。此结论只覆盖本报告的路由范围，不代表样式 HMR、性能门禁或整个 issue 已完成。

| 观察 | headless | Stable |
| --- | --- | --- |
| 首页主包与分包导航 | 6 个，文本与路径匹配 | 一致 |
| 原生恢复页 | `restored` | 一致 |
| Vue 恢复页 | `restored` | 一致 |
| 原有页面 | `external css vars initial` | 一致 |

测试先更新 App script marker，再仅通过页面源文件增删恢复，同时断言 `app.json` 注册及原生/Vue 六个 JS、JSON、WXML 输出文件存在或缺失，并检查 marker 保留。之后才启动 runtime、复用会话以 `reLaunch` 检查三个页面。因此没有声称运行中的 IDE 逐阶段动态注册、删除路由已验收。

最初的 native-only 两端结果仅为 2 用例、3 检查点，Vue 删除 CI 当时仍红：route 已从 `app.json` 移除，旧页面输出却被重新发射。根因是 snapshot `buildStart` 只处理外部 SFC 依赖失效，遗漏自身 SFC；完整发布遍历编译缓存，源码缺失时又回退旧结果。统一 snapshot/watch/HMR 源文件失效入口后，旧源码上两项单测失败（删除、同路径原子重建）转为 76/76 通过，整合后达到上述 200/200、CI 2/2 及双 provider 结果。首次 `expect.poll` 放在 `beforeAll` 的 harness 失败也保留：准备流程移入测试体，断言与预算未缩减。

验收基线为 `bed518b2b57d5853a1ab8c0e73c52dd9ab424aa3`，工作区含未提交修改；执行 tracked patch SHA-256 为 `74646b0fadbe9dff7780a9bdf5d33ee16af9ed98d8eecd1ec8446b9227e4bc4a`。登记的产品源码与 118 个 dist 文件在审计时仍完全相同，dist 成员清单一致。

执行后唯一 runtime 测试字节变化是 Vue checkpoint 的 route 从模板字符串改为等值字面量 `/pages/topology-vue/index`，用于静态清单识别；manifest 同步排序检查三条 route。归档 patch 可精确重建执行时文件并匹配摘要；常量值、两端已记录 route 和唯一差异共同证明等值，页面操作、reLaunch、断言及预算未变。**没有把原两轮结果冒充为最新字面量版本的 runtime 重跑。** JSON 保存两文件执行/审计摘要和完整差异。

官方稳定渠道于 `2026-10-04T16:05:40.619694+00:00` 查询，Stable、安装与连接版本均为 `2.02.2608080`，基础库 `3.17.3`。场景 runtime warn/error/exception 统计、case violation、报告 errors 均为 0；启动基础设施并非零告警：两组 `App.getCurrentPage` 合计 8 次重试均 recovered，另有一次 simulator boot 失败后自动恢复。原生 UI 的 `recovery.ax.txt` 确认了恢复后的宿主、所属项目与目标 pageframe；最终文本由后续 runtime 检查点证明。恢复中的 CLI/compile 能力提示及 punycode 告警未隐藏。

两轮资源均 closed、退出码 0、cleanupErrors 为空；两个 Stable 自有项目精确 CLI close 成功，三个登记端口关闭。审计只读检查的 22 个原登记进程身份均已退出；一个 PID 数值曾被后起无关进程复用，未操作该进程。临时拓扑项目已删除，受管 bridge 目录保留。原项目恢复由主任务负责。

资源记录的 report hash 使用 Python `json.dumps(report, sort_keys=True)` 序列化；两轮均按原口径重算通过，原始文件字节 hash 也单独保留。完整观测、失败历史、候选身份和证据摘要见 [结构化报告](auto-routes-topology-acceptance.json)。本次仅离线审计，没有新增测试、构建、性能采样或 root 修改。
