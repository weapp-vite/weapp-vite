# Wevu Runtime Perf Matrix

## `setData`

当前关注点：

- 是否高频整对象回写
- 使用 `weapp-vite` 编译的项目是否启用 `autoSetDataPick`（编译优化，不是独立运行时开关）
- 是否需要 `setData.strategy: 'diff' | 'patch'`
- 是否应启用 `suspendWhenHidden`
- 同一轮多个 ref/reactive 写入是否完整合并，后到的数组或对象 patch 是否被调度去重吞掉

### 阶段观测（仅需 wevu）

在要测量的页面/组件上显式开启，默认不启用；完整采样还需 `debugWhen: 'always'` 和 `debugSampleRate: 1`：

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

样本放在非响应式容器中，采集后导出并清空；不要在 debug 回调修改模板状态或无界保存日志。

- `phase.version` 当前为 `1`；同一运行时会话内以 `(phase.observerId, revision)` 关联逻辑更新，以 `phase.dispatch.id` 关联物理 `setData`。跨独立 bundle 或上下文还需采集端会话 ID。
- `prepare` 表示 payload/snapshot 就绪，空 diff 不产生 revision；`dispatch` 表示实际调用，`commit` 是 revision 账本的结算，不是可见视图完成。
- `completion` 的 callback、promise、return、throw、unknown 只描述适配器边界；Promise/thenable 优先于 callback。`visibleAt` 保持 `null`，不能把这些记录当作 paint 或真机显示完成。
- 同一物理调用可合并多个 revision。次数与 `payloadBytes` 按 dispatch ID 去重，不能相加 prepare/dispatch/commit 条数；字节是 JSON 的 UTF-8 大小，不含宿主协议开销，无法序列化时为 `null`。缺少 dispatch 不代表零调用，采样数据不能直接外推总量。
- 时间使用毫秒级 `Date.now()`，非单调；起止缺失或倒退时持续时间为 `null`，零毫秒只表示同一时钟刻度。prepare 含依赖刷新、序列化与 diff/patch；commit 耗时含同步调用、异步等待与观测成本。
- 旧 revision 完成不代表新 revision 成功。`needsFullSnapshot` 也可能是首次收集或路径无法定位，不能仅从 reason/warning 数量推断提交失败、完整 payload 或恢复成功；需结合 `commitFailure`、revision 和后续成功结算。
- 全局 `nextTick()` 只等待 JavaScript/响应式队列，不等待宿主 callback/Promise 或可见视图；现有实例 `$nextTick` 语义不变。另在目标 IDE/真机用本轮独有 marker 检查实际节点文本、可见性或样式，RPC/导航轮询耗时与框架阶段耗时分开记录。
- 开启观测会增加计时、回调与按物理调用的序列化开销。比较优化前后时保持输入、构建、适配器与观测配置相同，区分初始化和后续更新；没有宿主 heap 数据时保留内存证据缺口，不用 Node RSS 代替。

## 渲染

当前关注点：

- 是否在 `onPageScroll` 中放了重逻辑
- 是否可以改成 `useIntersectionObserver`
- 动画是否优先平台动画或 CSS

## 页面切换

当前关注点：

- `onHide/onUnload` 是否阻塞
- 页面切换窗口期是否做了多余清理或请求
- 是否该结合分包和预取策略一起看

## 资源与内存

当前关注点：

- 图片尺寸是否明显大于展示尺寸
- 缓存、监听、定时器是否在卸载时清理
- 内存告警后是否有统一释放路径
