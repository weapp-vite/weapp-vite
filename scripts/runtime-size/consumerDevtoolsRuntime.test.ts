import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from '../../e2e/utils/ideWarningReport'
import { verifyConsumerDevtoolsRuntime } from './consumerDevtoolsRuntime'

const launcher = vi.hoisted(() => ({ preflight: vi.fn(), launch: vi.fn() }))
vi.mock('../../e2e/utils/automator', () => ({
  assertDevtoolsLoggedIn: launcher.preflight,
  launchAutomator: launcher.launch,
  isDevtoolsHttpPortError: (error: unknown) => error instanceof Error && error.message === 'service port unavailable',
  isDevtoolsLoginRequiredError: () => false,
  isDevtoolsSimulatorBootError: () => false,
}))

describe('published consumer DevTools provider', () => {
  const directories: string[] = []
  beforeEach(() => {
    vi.clearAllMocks()
    launcher.preflight.mockResolvedValue(undefined)
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  async function consumer() {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'consumer-devtools-')))
    directories.push(root)
    await mkdir(path.join(root, 'dist'))
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'wxb3d842a4a7e3440d', miniprogramRoot: 'dist' }))
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', path.join(root, 'selected-cli'))
    return root
  }

  function host(scenario: 'minimal' | 'typical') {
    let text = scenario === 'minimal' ? 'minimal published consumer' : '1 / 2'
    const tap = vi.fn(async () => {
      text = '2 / 4'
    })
    const page = { path: 'pages/index/index', pageId: 1, $$: vi.fn(async () => [{ text: async () => text, tap }]) }
    const session = {
      reLaunch: vi.fn(async () => page),
      currentPage: vi.fn(async () => page),
      toolInfo: vi.fn(async () => ({ version: '2.02.2608080', SDKVersion: '3.17.3' })),
      flushConsole: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
    }
    launcher.launch.mockImplementation(async () => {
      appendIdeReportEvent({ source: 'runtime', kind: 'stats', project: 'consumer', error: 0, exception: 0 })
      return session
    })
    return { session, page, tap }
  }

  it('reads the exact consumer directory through strict page-frame DOM and restores caller environment', async () => {
    const root = await consumer()
    const { session, page } = host('minimal')
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', 'caller-journal')
    launcher.launch.mockImplementationOnce(async (options) => {
      expect(options.projectPath).toBe(root)
      expect(process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('devtools')
      const config = JSON.parse(await readFile(path.join(root, 'project.private.config.json'), 'utf8')) as { condition: { miniprogram: { list: Array<{ pathName: string }> } } }
      expect(config.condition.miniprogram.list.map(item => item.pathName)).toEqual(['pages/index/index'])
      appendIdeReportEvent({ source: 'runtime', kind: 'stats', project: 'consumer', error: 0, exception: 0 })
      return session
    })
    const result = await verifyConsumerDevtoolsRuntime(root, 'minimal')
    expect(result).toMatchObject({ provider: 'devtools', initial: { text: 'minimal published consumer' }, host: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.3' }, diagnosticCounts: {}, closed: true })
    expect(result.domEvidence?.map(item => item.source)).toEqual(['devtools-page-frame'])
    expect(launcher.launch).toHaveBeenCalledWith(expect.objectContaining({ bridgeProjectMode: 'direct', refreshProjectAfterConnect: true, skipWarmup: false, cliPath: path.join(root, 'selected-cli') }))
    expect(page.$$).toHaveBeenCalledWith('view', expect.objectContaining({ fallback: false }))
    expect(session.currentPage).toHaveBeenCalledWith({ appFunctionFallback: false })
    expect(session.disconnect).toHaveBeenCalledOnce()
    expect(process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER).toBe('headless')
    expect(process.env.WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE).toBe('caller-journal')
    await expect(readFile(path.join(root, 'project.private.config.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('observes the same lifecycle, reactive computation and real tap as headless', async () => {
    const root = await consumer()
    const original = '{"setting":{"compileHotReLoad":false},"condition":{"miniprogram":{"list":[]}}}\n'
    await writeFile(path.join(root, 'project.private.config.json'), original)
    const { session, tap } = host('typical')
    const result = await verifyConsumerDevtoolsRuntime(root, 'typical')
    expect(result.initial).toEqual({ text: '1 / 2', count: 1, computed: 2 })
    expect(result.afterTap).toEqual({ text: '2 / 4', count: 2, computed: 4 })
    expect(result.domEvidence?.map(item => item.id)).toEqual(['initial', 'after-tap'])
    expect(tap).toHaveBeenCalledOnce()
    expect(session.disconnect).toHaveBeenCalledOnce()
    expect(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).toBe(original)
  })

  it('requires an explicit selected CLI without launching an inferred host', async () => {
    const root = await consumer()
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', '')
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toMatchObject({ phase: 'preflight', category: 'environment' })
    expect(launcher.launch).not.toHaveBeenCalled()
  })

  it('records infrastructure failure and restores only its private project configuration', async () => {
    const root = await consumer()
    launcher.preflight.mockRejectedValueOnce(new Error('service port unavailable'))
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toMatchObject({ phase: 'preflight', category: 'environment' })
    expect(launcher.launch).not.toHaveBeenCalled()
    await expect(readFile(path.join(root, 'project.private.config.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects startup console errors even when every DOM assertion passes', async () => {
    const root = await consumer()
    const { session } = host('minimal')
    launcher.launch.mockImplementationOnce(async () => {
      appendIdeReportEvent({ source: 'runtime', kind: 'message', project: 'consumer', level: 'exception', text: 'startup failed' })
      return session
    })
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toThrow('startup failed')
    expect(session.disconnect).toHaveBeenCalledOnce()
  })

  it('preserves observation and cleanup errors and does not report a closed session', async () => {
    const root = await consumer()
    const { session } = host('minimal')
    session.reLaunch.mockRejectedValueOnce(new Error('render failed'))
    session.disconnect.mockRejectedValueOnce(new Error('disconnect failed'))
    const failure = await verifyConsumerDevtoolsRuntime(root, 'minimal').catch(error => error as AggregateError)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors.map(error => error.message)).toEqual(['Published consumer DevTools observe failed: render failed', 'disconnect failed'])
    expect(session.disconnect).toHaveBeenCalledOnce()
  })

  it('rejects missing host versions instead of inferring Stable from the executable path', async () => {
    const root = await consumer()
    const { session } = host('minimal')
    session.toolInfo.mockResolvedValueOnce({ version: '', SDKVersion: '3.17.3' })
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toThrow('actual IDE and base library versions')
    expect(session.disconnect).toHaveBeenCalledOnce()
  })

  it('rejects missing diagnostic evidence even when DOM observations succeed', async () => {
    const root = await consumer()
    const { session } = host('minimal')
    launcher.launch.mockResolvedValueOnce(session)
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toThrow('diagnostic journal is empty')
    expect(session.disconnect).toHaveBeenCalledOnce()
  })

  it('rejects a tourist AppID before touching the IDE', async () => {
    const root = await consumer()
    await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'touristappid', miniprogramRoot: 'dist' }))
    await expect(verifyConsumerDevtoolsRuntime(root, 'minimal')).rejects.toThrow('real WeChat AppID')
    expect(launcher.launch).not.toHaveBeenCalled()
  })
})
