# setData 阶段观测

`setData.debugPhases: true` 在现有 `debug` 回调中增加带 `phase` 的记录，默认关闭。旧的 diff/patch、回退和失败诊断仍保留；消费阶段数据时先筛选 `info.phase`。`debugWhen` 仍默认只记录回退，测量完整更新请设为 `always`。

```ts
import type { SetDataDebugInfo } from 'wevu'
import { defineComponent, ref } from 'wevu'

const samples: SetDataDebugInfo[] = []
defineComponent({
  setData: {
    debugPhases: true,
    debugWhen: 'always',
    debugSampleRate: 1,
    debug(info) {
      if (info.phase) {
        samples.push(info)
      }
    },
  },
  setup() {
    const count = ref(0)
    return { count, increment: () => count.value++ }
  },
})
```

样本保存在非响应式容器中，避免诊断回调修改模板状态、反向触发更新循环。长期采集应定期导出并清空容器。

## 记录与证据边界

`phase.version` 当前为 `1`。通过 `(phase.observerId, revision)` 关联同一实例的一轮更新；通过 `phase.dispatch.id` 关联物理调用。ID 只在同一运行时模块实例内唯一，跨项目、页面 JS 上下文或独立 bundle 的汇总还需要采集端的会话 ID。

| 字段或阶段 | 含义 |
| --- | --- |
| `prepare` | 调度依赖刷新到 payload/snapshot 就绪；空 diff 不产生 revision，也不产生阶段记录 |
| `dispatch` | 适配器实际调用 `setData` 后发出，记录 `startedAt`、`returnedAt` 与同步调用 `durationMs` |
| `commit` | 现有 revision 账本收到完成、失败、废弃或卸载信号；不是新的等待 API |
| `completion: callback` | 原生注册适配器的 `setData` callback 已调用 |
| `completion: promise` | 适配器返回的 Promise/thenable 已完成或拒绝，优先级高于 callback |
| `completion: return` | 普通适配器同步返回；只能证明调用返回 |
| `completion: throw` | 调用或 thenable 处理同步抛错 |
| `completion: unknown` | 内部自定义适配器没有提供物理边界，或还未下发/完成 |
| `visibleAt: null` | 框架没有测量可见视图、paint 或真机显示完成 |

时间来自 `Date.now()`，分辨率为毫秒，并非单调时钟。持续时间只在起止均存在且未倒退时计算；否则为 `null`。零毫秒代表同一时钟刻度内完成，不能解释为没有开销。`prepareDurationMs` 包含依赖刷新、序列化和 diff/patch；`commitDurationMs` 从物理调用开始到本次结算记录，包含同步调用、异步等待及观测开销。后台缓冲等待可由 `dispatch.startedAt - preparedAt` 单独计算，缺少边界时保持未知。

`result` 区分 `prepared`、`pending`、`committed`、`failed`、`abandoned`、`disposed`、`late-committed`、`late-failed` 和 `out-of-order`。`committedRevision` 是该记录发出时账本已确认的 revision；单次物理调用成功并不保证所有前序 delta 都已确认。旧 revision 的完成不能当作新 revision 的成功。

`needsFullSnapshot` 既用于 patch 策略的首次快照收集、无法定位变更路径后的重新收集，也用于提交失败后的恢复。首次收集仍可只下发 diff，不能从 reason 推断失败或完整 payload。失败恢复应结合此前的 `commitFailure`、revision 和对应成功结算判断；一条恢复尝试日志不能证明已恢复。

## 次数、字节与采样

后台或首屏缓冲可将多个逻辑 revision 合并为一次物理调用。各 revision 会共享同一 `dispatch.id` 与合并后的载荷字节数，**按 ID 去重后统计调用次数和字节**，不能累加阶段记录条数。`payloadBytes` 是 `JSON.stringify` 结果的 UTF-8 字节数，不含宿主协议封装；无法序列化时为 `null`。没有 `dispatch` 时不能将次数或字节记为零。

`performance` 预设默认开启 `diagnostics: 'fallback'`，独立使用 Wevu 时默认关闭内建日志。开启 `debugPhases` 后，同一 revision 的普通诊断与 prepare、dispatch、commit 记录都会进入已开启的内建 logger；一轮首次收集因此可能出现多条同 reason 的 warning。统计时先筛选 `info.phase`，再按 observer/revision 和 dispatch ID 关联、去重。对比初始化与后续更新应分别保留样本，不能从 warning 条数推导回退率。

```ts
const calls = new Map<number, number | null>()
for (const sample of samples) {
  const dispatch = sample.phase?.dispatch
  if (dispatch) {
    calls.set(dispatch.id, dispatch.payloadBytes)
  }
}
const observedCalls = calls.size
const observedBytes = [...calls.values()].includes(null)
  ? null
  : [...calls.values()].reduce<number>((sum, bytes) => sum + bytes!, 0)
```

阶段记录按 revision 采样一次，被选中的 revision 保留全部阶段。采样率小于 1、只记录回退、会话被提前结束或自定义适配器未报告物理边界时，上述统计只是观测到的调用，不能代表全部调用量，也不能直接按采样率外推。

## 等待与真实验收

全局 `nextTick()` 继续只等待 JavaScript/响应式队列，可早于延迟 callback 或 Promise 完成。现有实例 `$nextTick` 和内部宿主屏障语义不变。本功能不增加消费者等待 API，也不把 adapter 完成声明为视图完成。性能比较应另用每轮独有 marker 的真实 DOM/文本/计算样式断言；导航和 RPC 轮询耗时与框架阶段耗时分别记录。

仓库示例 `e2e-apps/github-issues/src/pages/issue-1138` 同时覆盖原生 callback 与延迟 Promise，配套同一 provider-compatible suite 在 headless 和 DevTools 下检查文本。延迟案例先让原生 callback 完成，再由测试显式释放适配器 Promise，证明三个边界互不等价。

关闭 `debugPhases` 时不会新增 payload 复制、计时、随机采样或 JSON 序列化。开启后会增加按物理调用的 JSON 序列化、计时和回调成本；不能将开启观测的数字视为无观测生产开销。比较时保持输入、构建和适配器相同，交错运行关闭/开启两组，保存原始样本；不预设性能收益。

普通配置与 `performance` 预设的比较还应记录实际 IDE、基础库、诊断配置及初始化边界。宿主 heap 不可观测时保留缺失原因，内存验收仍未完成；Node worker RSS、已完成的时序采样或零回退记录均不能替代 AppService heap，也不证明预设整体收益。
