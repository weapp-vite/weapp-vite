import { acquireAutomatorPortLease } from '@weapp-vite/miniprogram-automator'
import { startWechatIdeAgent } from '../../packages/weapp-ide-cli/src/cli/agentStart'
import { beginManagedWechatProject } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { resolveWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'

export interface ManagedAutomatorBridgeOptions {
  projectPath: string
  cliPath: string
  port: number
  timeout: number
  trustProject?: boolean
  signal?: AbortSignal
}

/** 启动回执在连接前持久化；握手失败或 worker 消失也不会丢失窗口所有权。 */
export async function startManagedAutomatorBridge(options: ManagedAutomatorBridgeOptions) {
  options.signal?.throwIfAborted()
  const portLease = await acquireAutomatorPortLease(options.port)
  const rawReleasePortLease = portLease.release.bind(portLease)
  let releasePortLease: Promise<void> | undefined
  const release = () => releasePortLease ??= rawReleasePortLease()
  let owner: Awaited<ReturnType<typeof beginManagedWechatProject>> | undefined
  try {
    const target = await resolveWechatDevtoolsTarget({ cliPath: options.cliPath })
    options.signal?.throwIfAborted()
    owner = await beginManagedWechatProject({ target, projectPath: options.projectPath, port: options.port })
    if (!owner) {
      throw new Error('IDE E2E requires a task-owned project journal before opening a window')
    }
    const result = await startWechatIdeAgent({
      ...options,
      target,
      onStarted: result => owner.confirm({ openedProjectWindow: result.openedProjectWindow, port: result.autoPort }),
    })
    return {
      wsEndpoint: `ws://127.0.0.1:${result.autoPort}`,
      managedProject: { id: owner.id, journalPath: owner.journalPath },
    }
  }
  catch (error) {
    const errors = [error]
    if (owner) {
      try {
        await owner.fail(error)
      }
      catch (recordError) {
        errors.push(recordError)
      }
      try {
        await owner.close()
      }
      catch (cleanupError) {
        errors.push(cleanupError)
      }
    }
    if (errors.length > 1) {
      await release().catch(releaseError => errors.push(releaseError))
      throw new AggregateError(errors, 'Managed IDE start and cleanup failed')
    }
    await release().catch((releaseError) => {
      throw new AggregateError([error, releaseError], 'Managed IDE start and cleanup failed')
    })
    throw error
  }
  finally {
    await release()
  }
}
