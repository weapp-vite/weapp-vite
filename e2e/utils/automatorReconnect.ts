import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { ResolvedWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'
import path from 'node:path'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { assertManagedInstallation, inspectManagedProjectHost, sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { readManagedRecord, withManagedJournalLock } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'
import { attachManagedProjectSession, getManagedProjectSessionOwner } from './managedProjectSession'

interface SessionMetadata {
  projectPath: string
  wsEndpoint: string
  port: number
  managedProject: { id: string, journalPath: string }
}

interface ReconnectOptions {
  target: ResolvedWechatDevtoolsTarget
  timeout: number
  connect: (options: { wsEndpoint: string, timeout: number, signal: AbortSignal }) => Promise<MiniProgram>
  configure: (session: MiniProgram, lifecycle: AutomatorLaunchLifecycle) => Promise<void>
}

interface ReconnectContext extends ReconnectOptions {
  metadata: SessionMetadata
  closeProject: () => Promise<void>
}

const contexts = new WeakMap<MiniProgram, ReconnectContext>()
const pendingConnections = new WeakMap<MiniProgram, Promise<MiniProgram>>()

function readSessionMetadata(session: MiniProgram): SessionMetadata | undefined {
  const value: unknown = Reflect.get(session, '__WEAPP_VITE_SESSION_METADATA')
  if (!value || typeof value !== 'object'
    || !('projectPath' in value) || typeof value.projectPath !== 'string'
    || !('wsEndpoint' in value) || typeof value.wsEndpoint !== 'string'
    || !('port' in value) || typeof value.port !== 'number'
    || !('managedProject' in value) || !value.managedProject || typeof value.managedProject !== 'object'
    || !('id' in value.managedProject) || typeof value.managedProject.id !== 'string'
    || !('journalPath' in value.managedProject) || typeof value.managedProject.journalPath !== 'string') {
    return undefined
  }
  return {
    projectPath: value.projectPath,
    wsEndpoint: value.wsEndpoint,
    port: value.port,
    managedProject: { id: value.managedProject.id, journalPath: value.managedProject.journalPath },
  }
}

/** 仅已成功启动并持有独立窗口 owner 的会话可以登记重连。 */
export function registerAutomatorReconnect<T extends MiniProgram>(session: T, options: ReconnectOptions): T {
  const metadata = readSessionMetadata(session)
  const closeProject = getManagedProjectSessionOwner(session)
  if (metadata && closeProject) {
    contexts.set(session, { ...options, target: { ...options.target }, metadata, closeProject })
  }
  return session
}

async function assertReconnectIdentity(context: ReconnectContext) {
  const { metadata, target } = context
  const endpoint = new URL(metadata.wsEndpoint)
  if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1'
    || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash
    || !Number.isInteger(metadata.port) || metadata.port < 1 || metadata.port > 65535
    || Number(endpoint.port) !== metadata.port) {
    throw new Error('Managed IDE reconnect endpoint does not match the owned local port.')
  }
  const record = await readManagedRecord(metadata.managedProject.journalPath, metadata.managedProject.id)
  if (record.state !== 'owned' || record.openedProjectWindow !== true || !record.host
    || record.closeAcknowledgedAt || record.windowClose?.dispatchedAt
    || record.id !== metadata.managedProject.id
    || path.resolve(record.journalPath) !== path.resolve(metadata.managedProject.journalPath)
    || path.resolve(record.projectPath) !== path.resolve(metadata.projectPath) || record.port !== metadata.port
    || record.target.installationId !== target.installationId || record.target.cliPath !== target.cliPath
    || record.target.appPath !== target.appPath || record.target.profileDir !== target.profileDir
    || record.target.version !== target.version || record.target.channel !== target.channel) {
    throw new Error('Managed IDE reconnect requires the same owned project, installation and port.')
  }
  await assertManagedInstallation(target)
  if (!sameManagedProcess(await inspectManagedProjectHost(target, metadata.port), record.host)) {
    throw new Error('Managed IDE reconnect listener identity changed; refusing to connect.')
  }
}

/** 完整重载只替换连接；不再次启动 agent、不新建 journal，也不隐式编译或导航。 */
export function reconnectAutomator(session: MiniProgram): Promise<MiniProgram> {
  const pending = pendingConnections.get(session)
  if (pending) {
    return pending
  }
  const context = contexts.get(session)
  if (!context) {
    return Promise.reject(new Error('Managed IDE reconnect requires a registered direct project session.'))
  }
  const reconnecting = withMachineE2ELease(async () => await withManagedJournalLock(context.metadata.managedProject.journalPath, async () => {
    const lifecycle = new AutomatorLaunchLifecycle(context.timeout, 'reconnect automator')
    return await lifecycle.run(async (scope) => {
      await scope.step(() => assertReconnectIdentity(context))
      await session.disconnect()
      const next = await scope.step(() => context.connect({
        wsEndpoint: context.metadata.wsEndpoint,
        timeout: scope.remainingMs(),
        signal: scope.signal,
      }), { stage: 'reconnect', waitForExit: true, disposeLate: candidate => candidate.disconnect() })
      scope.own(() => next.disconnect(), 'reconnected automator session')
      attachManagedProjectSession(next, context.closeProject)
      Reflect.set(next, '__WEAPP_VITE_SESSION_METADATA', {
        ...context.metadata,
        managedProject: { ...context.metadata.managedProject },
      })
      await scope.step(() => assertReconnectIdentity(context))
      await scope.step(() => context.configure(next, scope))
      scope.throwIfAborted()
      contexts.set(next, context)
      contexts.delete(session)
      return next
    })
  })).finally(() => pendingConnections.delete(session))
  pendingConnections.set(session, reconnecting)
  return reconnecting
}
