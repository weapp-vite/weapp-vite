import type { CompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import type { WatcherService } from '../watcherPlugin'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { onWatcherServiceDrained } from '../watcherPlugin'

type SidecarDeliveryContext = Pick<CompilerContext, 'configService'>
type SidecarDeliveryMatcher = (file: string, event: ChangeEvent) => boolean

interface SidecarDeliveryOwner {
  matches: SidecarDeliveryMatcher
  unregisterDrain?: () => void
}

const owners = new WeakMap<SidecarDeliveryContext, SidecarDeliveryOwner>()

/** 就绪的 classic 控制器认领侧车交付；旧代退出不能撤销替代代次的归属。 */
export function claimSidecarDelivery(ctx: SidecarDeliveryContext, matches: SidecarDeliveryMatcher, watcherService?: WatcherService) {
  owners.get(ctx)?.unregisterDrain?.()
  const owner: SidecarDeliveryOwner = { matches }
  owners.set(ctx, owner)
  const release = () => {
    owner.unregisterDrain?.()
    owner.unregisterDrain = undefined
    if (owners.get(ctx) === owner) {
      owners.delete(ctx)
    }
  }
  if (watcherService) {
    owner.unregisterDrain = onWatcherServiceDrained(watcherService, release)
  }
  return release
}

/** 只抑制已有真实交付方的合成 touch，不影响侧车扫描或缓存失效。 */
export function ownsSidecarDelivery(ctx: SidecarDeliveryContext, file: string, event: ChangeEvent) {
  return owners.get(ctx)?.matches(normalizeFsResolvedId(file), event) ?? false
}
