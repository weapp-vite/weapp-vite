import type { MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'

export interface AutoRoutesTopologyChange {
  file: string
  event: 'create' | 'delete'
  topologyChanged: boolean
  receivedAtMs?: number
}

type TopologyContext = Pick<MutableCompilerContext, 'autoRoutesService' | 'configService'>
type TopologyConsumer = (change: AutoRoutesTopologyChange) => void

const consumers = new WeakMap<TopologyContext, Set<TopologyConsumer>>()
const sources = new WeakMap<TopologyContext, { ownsFile: (file: string) => boolean }>()

/** 由实际物理 watcher 登记源所有权，监听器退出时只撤销自己持有的登记。 */
export function registerAutoRoutesTopologySource(ctx: TopologyContext, ownsFile: (file: string) => boolean) {
  const owner = { ownsFile }
  sources.set(ctx, owner)
  return () => {
    if (sources.get(ctx) === owner) {
      sources.delete(ctx)
    }
  }
}

/** 构建控制器持有订阅；短生命周期的 snapshot 插件不登记或替换消费者。 */
export function subscribeAutoRoutesTopology(ctx: TopologyContext, consume: TopologyConsumer) {
  let active = consumers.get(ctx)
  if (!active) {
    active = new Set()
    consumers.set(ctx, active)
  }
  const owned = active
  owned.add(consume)
  return () => {
    owned.delete(consume)
    if (consumers.get(ctx) === owned && owned.size === 0) {
      consumers.delete(ctx)
    }
  }
}

/** 路由目录 watcher 完成扫描后发布，调用者据返回值避免重复模拟 App 源码变更。 */
export function publishAutoRoutesTopology(ctx: TopologyContext, change: AutoRoutesTopologyChange) {
  const active = [...(consumers.get(ctx) ?? [])]
  for (const consume of active) {
    consume(change)
  }
  return active.length > 0
}

/** 只有已启用的路由 watcher 拥有的结构事件才从普通模块事件入口排除。 */
export function ownsAutoRoutesTopologyChange(ctx: TopologyContext, change: { file: string, event?: ChangeEvent }) {
  return Boolean(
    consumers.get(ctx)?.size
    && (change.event === 'create' || change.event === 'delete')
    && sources.get(ctx)?.ownsFile(change.file),
  )
}
