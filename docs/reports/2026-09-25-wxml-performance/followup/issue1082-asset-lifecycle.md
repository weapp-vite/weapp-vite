# Issue #1082：public 更新与资产删除生命周期

本次在 `37e0b40b55677c667984bf35a655b8eb1d39cf85` 上继续修正资产发布。原 Wevu 首次模板显示失败和完整性能门禁仍未完成，本页结果仅覆盖资产生命周期。

## 复现与根因

新增四项 CLI 回归首先全部失败：classic/stateful 的 public 首次编辑不更新，复制文件删除后旧产物仍存在。stateful 日志明确已收到 public 事件并开始快照；classic public 编辑未触发重建。复制文件删除则已触发构建，不能只归因于监听。

- classic 原资产监听只扫描源码复制规则，没有接入 Vite 最终解析的 public 目录。
- stateful 快照使用 `write:false`，不会经过 Vite 的 public 复制阶段；初始 writer 复制 public 不能覆盖后续更新。
- 原差分只发布新建和改变的内容，没有撤销上一轮拥有、当前已消失的资产。

## 实现边界

`asset/publicSources.ts` 统一 public 文件选择，支持任意扩展名、点文件、链接输入、自定义目录以及禁用设置；保留输出目录排除，不套用源码的 copy 过滤规则。classic 使用已解析配置接入原资产侧车。stateful 快照通过 `emitFile` 收集未被编译产物覆盖的 public 字节，public JS 也走资产刷新。

文件持久化仍由 Vite/Rolldown 原生 write 执行。删除在 `writeBundle` 内仅处理已拥有的失效输出，不清空整个目录；路径校验拒绝越界及指向输出根之外的符号链接父目录。编译产物与 public 同名时保留编译产物优先级。

发布失败不能等同于磁盘未变化。实现记录尚未提交、可能已经落盘的资产名称；后续成功快照决定保留或撤销。写盘失败后下一轮重新发布全部资产字节；写盘期间被新事件取代的成功批次仍更新实际磁盘基线，分析事实仅提交当前批次。增量及完整发布的新资产残留、删除后恢复同字节、写盘中被取代均有先失败后通过回归。

完整 headless 门禁还发现本次删除逻辑曾误删原生引擎拥有的 `app.prelude.js`：Component 后续导航失败，门禁为 5/6 场景、31/37 检查点。新增回归复现后，将快照归属收敛到既有 `isStatefulHmrSnapshotAsset`，同时保护主包和子目录 prelude；没有把缺失文件写回作为补救。修正后完整门禁通过，失败日志保留。

## 验证

| 范围 | 结果与限制 |
| --- | --- |
| CLI，classic/stateful 各三项 | 6/6，通过复制和 public 连续更新、任意扩展新增、raw JS、编译 app.js 碰撞、删除与同字节恢复；20.01 秒。此运行早于最终 prelude 归属收紧，后者由下述 runtime 验证覆盖 |
| 产品定向回归 | 第一轮 8 文件 147 项通过；随后部分失败资产归属修正 2 文件 39 项通过；最终 prelude 归属修正 2 文件 35 项通过，不将不同轮次拼成一次全量运行 |
| 最终 headless 门禁 | 6/6 场景、37/37 DOM，24.24 秒，包含新增资产场景、编辑器文件、新 computed/事件及三类模板往返 |
| 真实 DevTools | 2/2 场景、13/13 DOM，67.17 秒；资产生命周期 7 点、编辑器文件脚本往返 6 点 |
| mpcore 对应回归 | Node/browser session 各 1 项通过，保持 App/Page 身份、输入和点击行为；simulator typecheck 通过 |
| 其他检查 | weapp-vite typecheck、public types 和各次源码改动后的 build 通过；门禁六项覆盖契约 1 项通过；DOM 清单 111 tasks / 286 cases / 0 missing；共享启动 138 文件通过 |

新增 runtime 场景复用现有 suite 的唯一 automator 会话，通过 `reLaunch` 进入原生页面，不新增页面、AppID 或页面条件。测试从真实源文件创建、编辑、删除和恢复资产，逐步核对输出字节/不存在及 DOM、pageId、实例标记、输入、路由、query，最后点击验证计数 2 → 3。相关 helper 独立放置，原有 Wevu 断言不变。大文件只在原有发布/监听生命周期接入；扫描及删除逻辑拆入 `asset/`，不重排无关编译器逻辑。

首次单选 headless 资产场景得到 7/7，但下一次进程检查证实外部 preflight 于 15:20:36 UTC 启动，与测试 15:20:39–49 重叠，因此只作为观察结果保留。最终 headless 运行 15:46:52–15:47:16，真实 IDE 15:47:44–15:48:52，启动前后进程检查未见其他 E2E；随后识别的外部 preflight 开始于 15:49:27，晚于两次验证结束。

## 证据与交付状态

[脱敏归档](./issue1082-asset-lifecycle.json.gz) 解压 429116 字节，SHA256 `297f3a694cfef306a7d01c7a925d6a405bdd20fe6bb05fac18a6caca6f9e1ccf`。包含最初四项失败、事务失败、prelude 门禁失败及修正后的日志/DOM、并发观察限制、源文件 hash；日志原件 hash 单独保留。完整原件仅本地留存。

包含 weapp-vite/create-weapp-vite 中文 patch changeset。#1086 继续草稿；本次资产与原生页面状态验证不证明原 Wevu 首次模板问题或完整性能门禁已解决，#1082 保持开放。
