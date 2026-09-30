import type { ViteDevServer } from 'vite'
import type { CompilerContext } from '../context'
import type { DevModuleGraphChange, DevModuleGraphProvider } from './devProvider'

type HostContext = Pick<CompilerContext, 'moduleGraphService'>
interface GraphHost {
  server: ViteDevServer
  onChange?: (change: DevModuleGraphChange) => void
  onBuild?: (successful: boolean) => void
}
const hosts = new WeakMap<HostContext, GraphHost>()

/** 显式借用宿主图；释放借用不会关闭宿主服务器。 */
export function attachDevModuleGraphHost(context: HostContext, server: ViteDevServer, onBuild?: GraphHost['onBuild']) {
  if (hosts.has(context)) {
    throw new Error('[weapp-vite] 编译上下文已经绑定开发宿主。')
  }
  const host: GraphHost = { server, onBuild }
  hosts.set(context, host)
  return () => {
    if (hosts.get(context) === host) {
      hosts.delete(context)
    }
  }
}

export function notifyDevModuleGraphHost(context: HostContext, change: DevModuleGraphChange) {
  hosts.get(context)?.onChange?.(change)
}

export function reportDevModuleGraphBuild(context: HostContext, successful: boolean) {
  hosts.get(context)?.onBuild?.(successful)
}

export function hasDevModuleGraphHost(context: HostContext) {
  return hosts.has(context)
}

export function connectDevModuleGraphHost(context: HostContext, onChange: NonNullable<GraphHost['onChange']>): DevModuleGraphProvider | undefined {
  const host = hosts.get(context)
  if (!host) {
    return
  }
  host.onChange = onChange
  const release = context.moduleGraphService.bindDevServer(host.server)
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
