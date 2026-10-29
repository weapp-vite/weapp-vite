import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../context'
import type { DevModuleGraphChange, DevModuleGraphObserver, DevModuleGraphProvider } from './devProvider'
import type { DevModuleGraphSourceObservation } from './sourceObservation'
import { getDevModuleGraphSourceObservation, retireDevModuleGraphSourceObservation } from './sourceObservation'

type HostContext = Pick<CompilerContext, 'moduleGraphService'>
interface GraphHost {
  server: ViteDevServer
  onChange?: (change: DevModuleGraphChange) => void
  onBuild?: (successful: boolean) => void
  sourceObservation: DevModuleGraphSourceObservation
  pending: DevModuleGraphChange[]
}
const hosts = new WeakMap<HostContext, GraphHost>()

/** 显式借用宿主图；释放借用不会关闭宿主服务器。 */
export function attachDevModuleGraphHost(context: HostContext, server: ViteDevServer, onBuild?: GraphHost['onBuild']) {
  if (hosts.has(context)) {
    throw new Error('[weapp-vite] 编译上下文已经绑定开发宿主。')
  }
  const host: GraphHost = { server, onBuild, pending: [], sourceObservation: getDevModuleGraphSourceObservation(context) }
  hosts.set(context, host)
  return () => {
    if (hosts.get(context) === host) {
      hosts.delete(context)
      retireDevModuleGraphSourceObservation(context, host.sourceObservation)
    }
  }
}

export function notifyDevModuleGraphHost(context: HostContext, change: DevModuleGraphChange) {
  const host = hosts.get(context)
  if (host?.onChange) {
    host.onChange(change)
  }
  else {
    // 宿主 watcher 早于入口扫描就绪；事件所有权留在原宿主，交给唯一 provider 接管。
    host?.pending.push(change)
  }
}

export function reportDevModuleGraphBuild(context: HostContext, successful: boolean) {
  hosts.get(context)?.onBuild?.(successful)
}

export function hasDevModuleGraphHost(context: HostContext) {
  return hosts.has(context)
}

export function connectDevModuleGraphHost(context: HostContext, onChange: NonNullable<GraphHost['onChange']>, observe?: DevModuleGraphObserver): DevModuleGraphProvider | undefined {
  const host = hosts.get(context)
  if (!host) {
    return
  }
  host.onChange = onChange
  host.sourceObservation.bind(observe)
  const release = context.moduleGraphService.bindDevServer(host.server)
  for (const change of host.pending.splice(0)) {
    onChange(change)
  }
  let closed = false
  return {
    async close() {
      if (closed) {
        return
      }
      closed = true
      if (host.onChange === onChange) {
        host.onChange = undefined
      }
      release()
    },
  }
}
