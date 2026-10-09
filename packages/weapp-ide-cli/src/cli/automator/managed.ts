import type { Launcher, MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { OperationLifecycle } from '@weapp-vite/miniprogram-automator/operation'
import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import { acquireAutomatorPortLease } from '@weapp-vite/miniprogram-automator'
import { beginManagedWechatProject } from '../../devtoolsProjectOwnership'
import { assertWechatDevtoolsPort } from '../../devtoolsTarget'
import { startWechatIdeAgent } from '../agentStart'
import { persistAutomatorSession } from './sessionStore'

interface ManagedAutomatorOptions {
  launcher: Launcher
  scope: OperationLifecycle
  target: ResolvedWechatDevtoolsTarget
  projectPath: string
  sourceProjectPath: string
  port: number
  sessionId?: string
  persistAsDefaultSession?: boolean
  trustProject: boolean
}

/** 受管启动持有完整窗口回执，失败清理不受启动 deadline 的短暂宽限限制。 */
export async function launchManagedAutomator(options: ManagedAutomatorOptions): Promise<MiniProgram> {
  const { launcher, scope, target, projectPath, sourceProjectPath, port } = options
  const portLease = await scope.step(() => acquireAutomatorPortLease(port), {
    stage: 'port-lease',
    disposeLate: lease => lease.release(),
  })
  const rawReleasePortLease = portLease.release.bind(portLease)
  let releasedPortLease: Promise<void> | undefined
  portLease.release = () => releasedPortLease ??= rawReleasePortLease()
  const disownPortLease = scope.own(() => portLease.release(), 'automator-port-lease')
  let releasePortLeaseOnExit = true
  let intent: Awaited<ReturnType<typeof beginManagedWechatProject>>
  let program: MiniProgram | undefined
  try {
    intent = await beginManagedWechatProject({ target, projectPath, port })
    if (!intent) {
      throw new Error('DEVTOOLS_MANAGED_PROJECT_JOURNAL_REQUIRED: managed launch requires a project ownership journal.')
    }
    scope.throwIfAborted()
    await startWechatIdeAgent({
      target,
      projectPath,
      port,
      trustProject: options.trustProject,
      signal: scope.signal,
      timeout: scope.remainingMs(),
      onStarted: async result => await intent!.confirm({ openedProjectWindow: result.openedProjectWindow, port: result.autoPort }),
    })
    scope.throwIfAborted()
    await assertWechatDevtoolsPort(target, port, { signal: scope.signal, timeout: scope.remainingMs() })
    scope.throwIfAborted()
    const wsEndpoint = `ws://127.0.0.1:${port}`
    program = await launcher.connect({ wsEndpoint, signal: scope.signal, timeout: scope.remainingMs() }) as MiniProgram
    scope.throwIfAborted()
    await program.waitForAppReady(scope.remainingMs())
    scope.throwIfAborted()
    Reflect.set(program, '__WEAPP_VITE_SESSION_METADATA', {
      port,
      projectPath,
      wsEndpoint,
      managedProject: { id: intent.id, journalPath: intent.journalPath },
    })
    await persistAutomatorSession({
      installationId: target.installationId,
      signal: scope.signal,
      port,
      projectPath: sourceProjectPath,
      sessionId: options.sessionId,
      wsEndpoint,
    })
    scope.throwIfAborted()
    if (options.persistAsDefaultSession) {
      await persistAutomatorSession({ installationId: target.installationId, signal: scope.signal, projectPath: sourceProjectPath, wsEndpoint })
      scope.throwIfAborted()
    }
    const connectedProgram = program
    const ownedIntent = intent
    const rawDisconnect = (connectedProgram.disconnect as (...args: any[]) => any).bind(connectedProgram)
    connectedProgram.disconnect = (...args: any[]) => {
      try {
        return rawDisconnect(...args)
      }
      finally {
        void portLease.release()
      }
    }
    let closing: Promise<void> | undefined
    connectedProgram.close = async () => {
      closing ??= (async () => {
        try {
          connectedProgram.disconnect()
        }
        finally {
          try {
            await ownedIntent.close()
          }
          finally {
            await portLease.release()
          }
        }
      })().finally(() => { closing = undefined })
      return await closing
    }
    releasePortLeaseOnExit = false
    disownPortLease()
    return connectedProgram
  }
  catch (error) {
    const errors = [error]
    try {
      program?.disconnect()
    }
    catch (disconnectError) {
      errors.push(disconnectError)
    }
    if (intent) {
      try {
        await intent.fail(error)
      }
      catch (recordError) {
        errors.push(recordError)
      }
      try {
        await intent.close()
      }
      catch (closeError) {
        errors.push(closeError)
      }
    }
    if (releasePortLeaseOnExit) {
      disownPortLease()
      await portLease.release().catch(releaseError => errors.push(releaseError))
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Managed DevTools launch failed and project cleanup did not complete.', { cause: error })
    }
    throw error
  }
}
