import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import type { ManagedWechatProjectRecord } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { launchAutomator } from '../../../packages/weapp-ide-cli/src/cli/automator'
import { readManagedWechatProjectRecords } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { isManagedPortClosed } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { assertSelectedWechatDevtoolsRuntime } from '../../utils/devtoolsSelection'

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
export const START_TIMEOUT = 120_000

export interface RuntimeEvidence {
  version: string
  SDKVersion: string
}

export interface SessionEvidence {
  id: string
  journalPath: string
  projectPath: string
  port: number
  info: RuntimeEvidence
  ownerHost: ManagedWechatProjectRecord['host']
}

export interface OwnedSession extends SessionEvidence {
  program: MiniProgram
}

export interface LifecycleStep {
  name: string
  status: 'passed' | 'failed'
  startedAt: string
  durationMs: number
  evidence?: unknown
  error?: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function errorText(error: unknown): string {
  if (error instanceof AggregateError) {
    return `${error.message}: ${error.errors.map(errorText).join('; ')}`
  }
  return error instanceof Error ? error.stack || error.message : String(error)
}

export async function readBaseFixtureConfiguration() {
  const source = path.join(REPO_ROOT, 'e2e-apps/base')
  const config: unknown = JSON.parse(await fs.readFile(path.join(source, 'project.config.json'), 'utf8'))
  const privateConfig: unknown = JSON.parse(await fs.readFile(path.join(source, 'project.private.config.json'), 'utf8'))
  assert(isRecord(config) && typeof config.appid === 'string' && /^wx[\da-f]{16}$/i.test(config.appid), 'Base fixture must retain a real WeChat AppID')
  assert(isRecord(privateConfig), 'Base fixture private config must be an object')
  const sdkVersion = privateConfig.libVersion ?? config.libVersion
  assert(typeof sdkVersion === 'string' && /^\d+\.\d+\.\d+$/.test(sdkVersion), 'Base fixture must pin an effective SDK version')
  return { source, config, privateConfig, sdkVersion }
}

/** 仅复制已经构建的产物，临时项目配置固定有效基础库和现有真实 AppID。 */
export async function createLifecycleProject(runDirectory: string, name: string, fixture: Awaited<ReturnType<typeof readBaseFixtureConfiguration>>) {
  const { source, config, privateConfig, sdkVersion } = fixture
  const app: unknown = JSON.parse(await fs.readFile(path.join(source, 'dist/app.json'), 'utf8'))
  assert(isRecord(app) && Array.isArray(app.pages) && app.pages.length > 0, 'Build e2e-apps/base before running the lifecycle check')
  for (const page of app.pages) {
    assert(typeof page === 'string' && !page.includes('..') && !path.isAbsolute(page), 'Invalid base fixture page')
    for (const extension of ['.js', '.json', '.wxml']) {
      await fs.access(path.join(source, 'dist', `${page}${extension}`))
    }
  }
  const projectPath = path.join(runDirectory, 'projects', name)
  await fs.mkdir(projectPath, { recursive: true })
  await fs.cp(path.join(source, 'dist'), path.join(projectPath, 'dist'), { recursive: true, errorOnExist: true, force: false })
  await fs.writeFile(path.join(projectPath, 'project.config.json'), `${JSON.stringify({ ...config, projectname: `lifecycle-${name}`, miniprogramRoot: 'dist', libVersion: sdkVersion }, null, 2)}\n`)
  await fs.writeFile(path.join(projectPath, 'project.private.config.json'), `${JSON.stringify({ ...privateConfig, libVersion: sdkVersion }, null, 2)}\n`)
  return projectPath
}

export async function selectFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert(address && typeof address === 'object')
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

/** 工具版本与基础库都来自真实协议；安装元数据不能替代运行时证据。 */
export async function readRuntimeEvidence(target: ResolvedWechatDevtoolsTarget, program: MiniProgram, sdkVersion: string): Promise<RuntimeEvidence> {
  await assertSelectedWechatDevtoolsRuntime(target, program)
  const info: unknown = await program.toolInfo()
  assert(isRecord(info) && info.version === target.version && info.SDKVersion === sdkVersion, `Runtime must use selected IDE ${target.version} and SDK ${sdkVersion}`)
  return { version: String(info.version), SDKVersion: String(info.SDKVersion) }
}

export async function openLifecycleSession(target: ResolvedWechatDevtoolsTarget, projectPath: string, sdkVersion: string, signal?: AbortSignal): Promise<OwnedSession> {
  const port = await selectFreePort()
  const program = await launchAutomator({ projectPath, target, port, runtimeProvider: 'devtools', timeout: START_TIMEOUT, preserveProjectRoot: true, trustProject: true, signal }) as MiniProgram
  try {
    const metadata: unknown = Reflect.get(program, '__WEAPP_VITE_SESSION_METADATA')
    assert(isRecord(metadata) && isRecord(metadata.managedProject), 'Managed launch must return its ownership journal')
    const owner = metadata.managedProject
    assert(typeof owner.id === 'string' && typeof owner.journalPath === 'string', 'Managed owner identity is incomplete')
    const records = await readManagedWechatProjectRecords(owner.journalPath)
    const record = records.find(value => value.id === owner.id)
    assert(record?.openedProjectWindow === true && record.state === 'owned', 'Unique lifecycle fixture must open an owned window')
    assert.equal(record.projectPath, projectPath)
    assert.equal(record.port, port)
    return { program, projectPath, port, id: owner.id, journalPath: owner.journalPath, ownerHost: record.host, info: await readRuntimeEvidence(target, program, sdkVersion) }
  }
  catch (error) {
    await program.close().catch((cleanupError: unknown) => {
      throw new AggregateError([error, cleanupError], 'Lifecycle session validation and cleanup failed')
    })
    throw error
  }
}

export function sessionEvidence(session: OwnedSession): SessionEvidence {
  const { program: _program, ...evidence } = session
  return evidence
}

/** 验收独立核验销毁凭据，避免仅凭 released 标记和端口关闭得到假通过。 */
async function assertOwnedWindowDestruction(record: ManagedWechatProjectRecord) {
  assert(record.openedProjectWindow === true && record.releasedReason === 'project-closed', 'Owned project release must retain its official opened-window receipt')
  const evidence = record.windowClose
  assert(evidence?.protocol === 'wechat-devtools-window-close-trace-v1' && !evidence.failure, 'Owned project release requires unambiguous native-window evidence')
  assert(record.target.version && evidence.productVersion === record.target.version, 'Window destruction must match the selected IDE version')
  assert.equal(evidence.profileDir, await fs.realpath(record.target.profileDir), 'Window destruction must use the selected IDE profile')
  const window = evidence.window
  assert(window && !window.cancelled && window.winId && window.runtimeId && Number.isSafeInteger(window.browserWindowId) && window.browserWindowId > 0, 'Window destruction requires its exact runtime and native window identity')
  assert(evidence.cursors.filter(cursor => cursor.identity === window.fileIdentity).length === 1, 'Window destruction must retain its original log file identity')
  const calls = evidence.calls.filter(call => call.fileIdentity === window.fileIdentity && call.winId === window.winId)
  assert(calls.length === 1 && !calls[0]!.cancelled && calls[0]!.browserWindowId === window.browserWindowId && calls[0]!.calledAt === window.calledAt, 'Window destruction must match one exact native close call')
  const time = (value: string | undefined, label: string) => {
    assert(value && Number.isFinite(Date.parse(value)), `Window destruction requires a valid ${label} timestamp`)
    return Date.parse(value)
  }
  const capturedAt = time(evidence.capturedAt, 'capture')
  const dispatchedAt = time(evidence.dispatchedAt, 'dispatch')
  const calledAt = time(window.calledAt, 'native close call')
  const requestedAt = time(window.requestedAt, 'exact project request')
  const nativeClosedAt = time(window.nativeClosedAt, 'native window closed')
  const webContentsDestroyedAt = time(window.webContentsDestroyedAt, 'webcontents destroyed')
  assert(capturedAt >= time(record.createdAt, 'ownership creation') && dispatchedAt >= capturedAt && calledAt >= capturedAt && requestedAt >= calledAt, 'Window destruction must belong to this ownership generation and close attempt')
  assert(nativeClosedAt >= requestedAt && webContentsDestroyedAt >= requestedAt, 'Both native destruction events must follow the exact project close request')
  return { protocol: evidence.protocol, productVersion: evidence.productVersion, capturedAt: evidence.capturedAt, dispatchedAt: evidence.dispatchedAt, ...window }
}

export async function assertSessionReleased(session: Pick<SessionEvidence, 'id' | 'journalPath' | 'port'>) {
  const record = (await readManagedWechatProjectRecords(session.journalPath)).find(value => value.id === session.id)
  assert(record && record.state === 'released', 'Project owner must reach the released state')
  assert.equal(record.port, session.port, 'Released project must retain its original automator port')
  const windowClose = await assertOwnedWindowDestruction(record)
  assert(await isManagedPortClosed(session.port), 'Released project automator port must be closed')
  return { id: session.id, state: record.state, releasedReason: record.releasedReason, port: session.port, portClosed: true, windowClose }
}

export async function assertJournalReleased(journalPath: string) {
  const records = await readManagedWechatProjectRecords(journalPath)
  assert(records.every(record => record.state === 'released'), 'Lifecycle journal still contains active or unresolved projects')
  return await Promise.all(records.map(async (record) => {
    if (record.openedProjectWindow) {
      const windowClose = await assertOwnedWindowDestruction(record)
      assert(record.port && await isManagedPortClosed(record.port), 'Released lifecycle journal still has an open owned port')
      return { id: record.id, state: record.state, releasedReason: record.releasedReason, port: record.port, portClosed: true, windowClose }
    }
    assert(record.openedProjectWindow === false && record.releasedReason === 'borrowed', 'Released borrowed projects must retain their non-ownership receipt')
    return { id: record.id, state: record.state, releasedReason: record.releasedReason, port: record.port }
  }))
}

export async function assertOwnedWindowLimit(journalPath: string, maximum = 2): Promise<ManagedWechatProjectRecord[]> {
  const records = await readManagedWechatProjectRecords(journalPath)
  for (const record of records.filter(record => record.openedProjectWindow && record.state === 'released')) {
    await assertOwnedWindowDestruction(record)
  }
  assert(records.filter(record => record.openedProjectWindow && record.state !== 'released').length <= maximum, `Lifecycle check exceeded ${maximum} owned windows`)
  return records
}

export async function recordStep<T>(steps: LifecycleStep[], name: string, run: () => Promise<T>) {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  try {
    const evidence = await run()
    steps.push({ name, status: 'passed', startedAt, durationMs: Math.round(performance.now() - started), evidence })
    process.stdout.write(`[devtools-lifecycle] passed: ${name}\n`)
    return evidence
  }
  catch (error) {
    steps.push({ name, status: 'failed', startedAt, durationMs: Math.round(performance.now() - started), error: errorText(error) })
    throw error
  }
}
