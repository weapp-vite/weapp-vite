# HMR v2 run02 静态审计

本轮诊断数据完整，**H1 证据不足**。两个目标的全部 18 次相位预测都满足预先固定的 15ms 容差，但 5 次 plain-wxss 保存前存在 profile 文件回调扰动，且多数 0/120ms 对照的 ready 相位不一致；不能宣称完整相位因果假设成立。本审计仅读取既有证据，没有重采样、运行 runtime/dev/watch 或修改正式比较器。

完整数值、模块身份与原始证据 SHA-256 见 [JSON 审计](./hmr-v2-run02-audit.json)。`formalPerformanceVerdict` 保持 `not-evaluated`；正式 baseline `73b76f4acde84a4ac8c25f4b816119b19704ac28`、candidate/collector `8cd8b9ccf897ce7d40ada65681356093416d6fbd`、20 pairs、5% 门槛及既有 **2 regression / 3 unstable** 均不变。不能据本轮给 #1082、#1133、#1134 标记完成。

## 完整性与身份

- 9 个 session 顺序为 `0,60,120 / 60,120,0 / 120,0,60`，各 36 次保存，共 324 次；只有 `plain-wxss:first:restore`、`scss:repeat:edit` 加偏移，共 18 个目标观察。逐条核对 save、源 hash、hotUpdate、原始 producer event/build/clock、detection、generation、dispatch，均唯一对应；0 unmatched、0 overflow、0 重绑。
- 9 场景、2 cycles、120ms polling、300ms settle、500ms budget、30s output timeout、15s profile timeout 和 marker seed 保持冻结配置。0 arm 不新增 timer 或异步让出。每轮 36 个原始 profile 均为 complete；report 与 raw 的差异仅为既有路径相对化及 collector 补充字段。
- 输入保持 37 文件、3,696 字节，manifest SHA-256 为 `24719147489fbfcb49a7ae7abca419af2e3100feea5b6f46395cb2f4b35bc81b`。实际加载 collector、save helper、Vite 8.3.2 chunk、构建后的 provider 的原始及插桩哈希逐轮一致，并与本次构建后冻结身份相符。当前逐字节复核 797 个冻结文件及两个 dist 的成员清单均无漂移；18 个进程 trace 均记录 Node v24.18.0。
- run01 的 9 个 session 在 loader 校验处失败，产生 0 样本；已保留该失败轮。run02 仅调整为先注册诊断 preload、再注册 tsx，保留严格原始字节哈希检查及所有采样参数；新 harness 哈希与修正审阅清单一致，没有替换失败样本。
- 9 份最终 dist 各 21 文件，逐份字节与其 manifest 一致，文件成员相同。跨 session 的 6 个 JS 字节差异仅来自 `//#region` 中本轮 fixture 路径；原始字节与哈希均保留，没有将这些差异改写为原始产物完全相同。
- 10 个登记进程组均为 closed，9 个 fixture 目录均为 removed；审计时另读实际 PID/PGID 和文件系统，未找到对应存活进程组或目录。只保留证据目录，本审计没有终止进程或删除资源。

## 固定 15ms 容差下的结果

R 为 atomic rename 完成，D 为 watchFile 发现变更的回调，C 为 Chokidar 分发，H 为 Vite hotUpdate。相位锚点只取同文件、同 watcher generation 的上次变更回调。下表耗时单位均为 ms，D−R、C−D、H−C、bundler 列为各 arm 三次观察的中位数。

| 目标 | 偏移 | 预测误差范围 | ≤15ms | 无前置扰动 | D−R | C−D | H−C | bundler |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| plain-wxss first restore | 0 | 0.60–3.15 | 3/3 | 3/3 | 33.52 | 0.020 | 0.320 | 178.98 |
| plain-wxss first restore | 60 | 0.88–4.61 | 3/3 | 0/3 | 103.23 | 0.022 | 0.411 | 155.86 |
| plain-wxss first restore | 120 | 0.73–3.51 | 3/3 | 1/3 | 56.57 | 0.020 | 0.600 | 151.31 |
| scss repeat edit | 0 | 2.64–6.20 | 3/3 | 3/3 | 27.11 | 0.035 | 0.406 | 234.93 |
| scss repeat edit | 60 | 4.47–5.88 | 3/3 | 3/3 | 95.50 | 0.035 | 0.612 | 251.58 |
| scss repeat edit | 120 | 2.95–6.53 | 3/3 | 3/3 | 42.77 | 0.034 | 0.241 | 214.77 |

18 个目标的实际延迟误差为 −0.337 至 +1.134ms，均满足容差；唯一负值完整保留。目标 D−R 为 24.55 至 105.29ms，而 C−D 最大 0.300ms、H−C 最大 0.798ms，支持主要等待发生在检测前的解释。各 arm 的 bundler 中位数仍有 27.67ms（plain-wxss）和 36.81ms（SCSS）跨度，不能把 wall 变化全部归因于 polling。

全部 324 次中有 72 次没有此前同文件变更回调，无法应用相位模型，保留为 unknown；不存在“上一回调属于其他 generation”的样本。没有负的 D−R，5 个前置扰动均保留。watchFile 变更回调不暴露无变化 polling tick，因此即使残差小，也不能把该近似相位锚点当作逐 tick 观测。

同 block 的 0/120ms ready 相位圆周差分别为：plain-wxss 10.81、59.20、35.07ms；SCSS 53.31、36.35、3.06ms。只有 plain-wxss block 1 和 SCSS block 3 满足 ≤15ms，前者还存在扰动。唯一同时满足起始相位与无扰动条件的 SCSS block 3，120ms 相对 0ms 的 D−R 差为 −2.18ms；这一对与整周期预期相容，但不能代表三次重复或两个目标。未事后跨 block 挑选配对。

## 前置扰动与可证伪检查

5 次扰动全部是 `unmatched-provider-onChange`，文件均为项目的 `.weapp-vite/hmr-profile.jsonl`，出现在 ready 后 11.29–58.46ms、measurement 之前；plain-wxss 的 60ms arm 三次均出现，120ms arm 两次出现。它们不是目标源文件的 watcher 重绑或额外目标 hotUpdate。

冻结源码中的可解释链路是：`runtime/buildPlugin/service.ts` 的 `writeHmrProfileJsonSample` 在发布后排队 append profile，Vite 将文件变化送到 `moduleGraph/devProvider.ts` 的 `hotUpdate`，后者 `read()` 后调用 `onChange`。诊断 wrapper 只为 `src` 内文件建立关联上下文，profile 位于其外，因此记录为 unmatched。下游无关联 module 且没有首次构建失败时会提前返回；本轮仍只有预定的 36 个完整 raw profile，没有观察到额外构建记录。

这些 trace 没有记录该 profile 文件的 append 完成、底层 detection 或 callback 返回时间，所以“哪个 append 唯一触发了它”和“回调耗时多少”仍未证实；不能据源码推断把这 5 次标成无影响，更不能删去它们来满足 H1。

下一项最小可证伪检查应锁定 profile 输出的事件边界：以聚焦回归验证配置的 profile 文件变化不会进入 snapshot 调度或产生新的 source profile。若随后确需量化开销，再单独记录同一文件 append/接收/返回边界，保留编号和原结论。本轮不继续采样以求通过。

每轮输入及前后身份校验由成功运行的 harness 强制执行，但没有逐次保存独立身份快照，已删除的输入副本也无法重新逐字节检查。本文因此区分实际 loader 证据、现存字节复核和运行守卫结果。插桩开销、跨进程 epoch 对齐及每 arm 仅三次观察共同限制因果解释，均不能替代正式性能或真实 IDE runtime 验收。
