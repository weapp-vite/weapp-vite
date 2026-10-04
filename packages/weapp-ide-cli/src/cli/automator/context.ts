import type { DevtoolsRuntimeSessionOptions } from '@weapp-vite/devtools-runtime'
import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import process from 'node:process'
import { resolveWechatDevtoolsTarget } from '../../devtoolsTarget'
import { assertAutomatorPort } from './port'

export interface AutomatorInstallationOptions extends DevtoolsRuntimeSessionOptions {
  target?: ResolvedWechatDevtoolsTarget
  signal?: AbortSignal
}

/** 在连接与共享缓存入口固定安装选择；headless 不读取或修改 IDE 状态。 */
export async function resolveAutomatorSessionOptions<T extends AutomatorInstallationOptions>(options: T): Promise<T & AutomatorInstallationOptions & { installationId: string }> {
  assertAutomatorPort(options.port)
  options.signal?.throwIfAborted()
  const runtimeProvider = options.runtimeProvider
    ?? process.env.WEAPP_VITE_AUTOMATOR_RUNTIME_PROVIDER
    ?? process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER
  if (runtimeProvider === 'headless') {
    return { ...options, runtimeProvider, installationId: 'headless' }
  }
  const target = await resolveWechatDevtoolsTarget(options)
  options.signal?.throwIfAborted()
  if (options.installationId && options.installationId !== target.installationId) {
    throw Object.assign(new Error('DEVTOOLS_INSTALLATION_MISMATCH: resolved installation does not match the selected session.'), { code: 'DEVTOOLS_INSTALLATION_MISMATCH' })
  }
  return { ...options, target, cliPath: target.cliPath, installationId: target.installationId }
}
