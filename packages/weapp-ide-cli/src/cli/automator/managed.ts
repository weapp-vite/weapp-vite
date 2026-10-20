import type { Launcher, MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { OperationLifecycle } from '@weapp-vite/miniprogram-automator/operation'
import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import { acquireAutomatorPortLease } from '@weapp-vite/miniprogram-automator'
import { beginManagedWechatProject } from '../../devtoolsProjectOwnership'
import { assertWechatDevtoolsPort } from '../../devtoolsTarget'
import { startWechatIdeAgent } from '../agentStart'
import { populateAutomatorProjectSnapshot, readAutomatorProjectPlan } from '../automatorProject'
import { importManagedDevtoolsProject } from '../projectImport'
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
  preserveProjectRoot?: boolean
  trustProject: boolean
}

/** 受管启动持有完整窗口回执，快照始终由持久 journal 持有。 */
export async function launchManagedAutomator(options: ManagedAutomatorOptions): Promise<MiniProgram> {
  const { launcher, scope, target, sourceProjectPath, port } = options
  let projectPath = options.projectPath
  let portLease: Awaited<ReturnType<typeof acquireAutomatorPortLease>> | undefined
  let intent: Awaited<ReturnType<typeof beginManagedWechatProject>>
  let program: MiniProgram | undefined
  let allowCleanup!: () => void
  const acquisitionSettled = new Promise<void>((resolve) => {
    allowCleanup = resolve
  })
  let cleaning: Promise<void> | undefined
  const cleanupLaunch = () => cleaning ??= (async () => {
    // 官方回执或复制可能迟于取消结束；先等登记停止，再使用原 owner 清理。
    await acquisitionSettled
    const errors: unknown[] = []
    let disconnected = !program
    try {
      await program?.disconnect()
      disconnected = true
    }
    catch (error) {
      errors.push(error)
    }
    let projectClosed = !intent
    try {
      await intent?.close()
      projectClosed = true
    }
    catch (error) {
      errors.push(error)
    }
    if (disconnected && projectClosed) {
      await portLease?.release().catch(error => errors.push(error))
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Managed DevTools session cleanup failed')
    }
  })().catch((error: unknown) => {
    cleaning = undefined
    throw error
  })
  let disownResources = () => {}
  try {
    disownResources = scope.own(cleanupLaunch, 'managed-automator-session')
    const snapshotPlan = options.preserveProjectRoot
      ? undefined
      : await readAutomatorProjectPlan(projectPath)
    scope.throwIfAborted()
    if (snapshotPlan) {
      intent = await beginManagedWechatProject({ target, projectPath, port, snapshotProject: true })
      if (!intent) {
        throw new Error('DEVTOOLS_MANAGED_PROJECT_JOURNAL_REQUIRED: managed launch requires a project ownership journal.')
      }
      projectPath = intent.projectPath
      await intent.prepareSnapshot(async destination => await populateAutomatorProjectSnapshot(snapshotPlan, destination))
      scope.throwIfAborted()
    }
    await scope.step(() => importManagedDevtoolsProject({
      cliPath: target.cliPath,
      projectPath,
      trusted: options.trustProject,
      timeout: scope.remainingMs(),
      signal: scope.signal,
    }), { stage: 'project-import' })
    scope.throwIfAborted()
    portLease = await scope.step(() => acquireAutomatorPortLease(port), {
      stage: 'port-lease',
      disposeLate: lease => lease.release(),
    })
    const rawReleasePortLease = portLease.release.bind(portLease)
    let releasedPortLease: Promise<void> | undefined
    portLease.release = () => releasedPortLease ??= rawReleasePortLease().catch((error: unknown) => {
      releasedPortLease = undefined
      throw error
    })
    intent ??= await beginManagedWechatProject({ target, projectPath, port })
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
      ...(snapshotPlan ? { onBeforeDispatch: async () => await intent!.markLaunchDispatched() } : {}),
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
    const ownedPortLease = portLease
    const rawDisconnect = (connectedProgram.disconnect as (...args: any[]) => any).bind(connectedProgram)
    let disconnecting: Promise<void> | undefined
    connectedProgram.disconnect = (...args: any[]) => {
      disconnecting ??= (async () => {
        await rawDisconnect(...args)
        await ownedPortLease.release()
      })().catch((error: unknown) => {
        disconnecting = undefined
        throw error
      })
      return disconnecting
    }
    let closing: Promise<void> | undefined
    connectedProgram.close = async () => {
      closing ??= (async () => {
        const errors: unknown[] = []
        let disconnected = false
        try {
          await connectedProgram.disconnect()
          disconnected = true
        }
        catch (error) {
          errors.push(error)
        }
        let projectClosed = false
        try {
          await ownedIntent.close()
          projectClosed = true
        }
        catch (error) {
          errors.push(error)
        }
        if (disconnected && projectClosed) {
          await ownedPortLease.release().catch(error => errors.push(error))
        }
        if (errors.length) {
          throw new AggregateError(errors, 'Managed DevTools session cleanup failed')
        }
      })().finally(() => { closing = undefined })
      return await closing
    }
    disownResources()
    allowCleanup()
    return connectedProgram
  }
  catch (error) {
    const errors = [error]
    if (intent) {
      try {
        await intent.fail(error)
      }
      catch (recordError) {
        errors.push(recordError)
      }
    }
    allowCleanup()
    try {
      await cleanupLaunch()
      disownResources()
    }
    catch (cleanupError) {
      errors.push(...(cleanupError instanceof AggregateError ? cleanupError.errors : [cleanupError]))
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Managed DevTools launch failed and project cleanup did not complete.', { cause: error })
    }
    throw error
  }
}
