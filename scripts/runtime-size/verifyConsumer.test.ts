import type { ConsumerRuntimeObservation } from './consumerRuntime'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyPublishedConsumer } from './verifyConsumer'

const dependencies = vi.hoisted(() => ({ exec: vi.fn(), devtools: vi.fn(), headless: vi.fn(), loadHeadless: vi.fn() }))
vi.mock('tinyexec', () => ({ exec: dependencies.exec }))
vi.mock('esbuild', () => ({ build: vi.fn(async () => {}) }))
vi.mock('./consumerDevtoolsRuntime', () => ({ verifyConsumerDevtoolsRuntime: dependencies.devtools }))
vi.mock('./consumerRuntime', async original => ({
  ...await original<typeof import('./consumerRuntime')>(),
  loadConsumerRuntime: dependencies.loadHeadless,
  verifyConsumerRuntime: dependencies.headless,
}))

describe('published consumer runtime orchestration', () => {
  const directories: string[] = []
  beforeEach(() => {
    vi.clearAllMocks()
    dependencies.loadHeadless.mockResolvedValue({ package: { name: '@mpcore/test', entry: 'node_modules/@mpcore/test/index.mjs' } })
    dependencies.exec.mockImplementation(async (_executable, _arguments, options) => {
      const root = options.nodeOptions.cwd as string
      const source = await readFile(path.join(root, 'src/pages/index/index.vue'), 'utf8')
      await mkdir(path.join(root, 'dist/pages/index'), { recursive: true })
      for (const extension of ['js', 'json', 'wxml']) {
        await writeFile(path.join(root, 'dist/pages/index', `index.${extension}`), source)
      }
      await writeFile(path.join(root, 'consumer-attribution.json'), JSON.stringify({ source }))
      return { exitCode: 0, stdout: '', stderr: '' }
    })
  })
  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  async function consumer() {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'consumer-verification-')))
    directories.push(root)
    await mkdir(path.join(root, 'src/pages/index'), { recursive: true })
    await writeFile(path.join(root, 'src/pages/index/index.vue'), '<template><view>original benchmark</view></template>')
    await writeFile(path.join(root, 'weapp-vite.config.ts'), 'export default defineConfig(() => ({}))\n')
    await writeFile(path.join(root, 'package-lock.json'), '{}')
    return root
  }

  function observation(scenario: 'minimal' | 'typical', provider: 'headless' | 'devtools'): ConsumerRuntimeObservation {
    return {
      scenario,
      provider,
      route: '/pages/index/index',
      initial: scenario === 'minimal' ? { text: 'minimal published consumer' } : { text: '1 / 2', count: 1, computed: 2 },
      ...(scenario === 'typical' ? { afterTap: { text: '2 / 4', count: 2, computed: 4 } } : {}),
      diagnosticCounts: {},
      closed: true,
    }
  }

  async function report(root: string) {
    return JSON.parse(await readFile(path.join(root, 'runtime-attribution-evidence/verification.json'), 'utf8')) as {
      status: string
      runtimeValidation: string
      stableDevtoolsValidation: string
      scenarioSource: unknown
      runtimeArtifacts: Record<string, Array<{ sha256: string }>>
      runtimeObservations: ConsumerRuntimeObservation[]
      failureDetails: { phase?: string, category?: string }
    }
  }

  it('uses identical scenario sources and explicit built outputs for both providers', async () => {
    const devtoolsRoot = await consumer()
    const headlessRoot = await consumer()
    dependencies.devtools.mockImplementation(async (root: string, scenario: 'minimal' | 'typical') => {
      const source = await readFile(path.join(root, 'src/pages/index/index.vue'), 'utf8')
      expect(await readFile(path.join(root, 'dist/pages/index/index.wxml'), 'utf8')).toBe(source)
      return observation(scenario, 'devtools')
    })
    dependencies.headless.mockImplementation(async (_root: string, scenario: 'minimal' | 'typical') => observation(scenario, 'headless'))
    await verifyPublishedConsumer([devtoolsRoot, '--disposable-consumer', '--runtime=devtools'])
    expect(dependencies.loadHeadless).not.toHaveBeenCalled()
    await verifyPublishedConsumer([headlessRoot, '--disposable-consumer', '--runtime=headless'])
    const devtools = await report(devtoolsRoot)
    const headless = await report(headlessRoot)
    expect(devtools.status).toBe('passed')
    expect(devtools.runtimeValidation).toBe('devtools-passed')
    expect(devtools.stableDevtoolsValidation).toContain('official-stable-channel-evidence-required')
    expect(devtools.scenarioSource).toEqual(headless.scenarioSource)
    expect(devtools.runtimeArtifacts).toEqual(headless.runtimeArtifacts)
    expect(devtools.runtimeObservations.map(item => item.scenario)).toEqual(['minimal', 'typical'])
    expect(await readFile(path.join(devtoolsRoot, 'src/pages/index/index.vue'), 'utf8')).toContain('original benchmark')
    expect(dependencies.exec).toHaveBeenCalledTimes(8)
  })

  it('keeps environment failures explicit and restores the disposable source without falling back', async () => {
    const root = await consumer()
    dependencies.devtools.mockRejectedValueOnce(Object.assign(new Error('selected CLI requires login'), { phase: 'preflight', category: 'environment' }))
    await expect(verifyPublishedConsumer([root, '--disposable-consumer', '--runtime=devtools'])).rejects.toThrow('requires login')
    expect(await report(root)).toMatchObject({ status: 'failed', runtimeValidation: 'devtools-not-completed', stableDevtoolsValidation: 'failed-final-runtime-acceptance-incomplete', failureDetails: { phase: 'preflight', category: 'environment' } })
    expect(dependencies.headless).not.toHaveBeenCalled()
    expect(await readFile(path.join(root, 'src/pages/index/index.vue'), 'utf8')).toContain('original benchmark')
  })

  it('rejects mutation of a consumer artifact during runtime verification', async () => {
    const root = await consumer()
    dependencies.devtools.mockImplementationOnce(async (directory: string, scenario: 'minimal' | 'typical') => {
      await writeFile(path.join(directory, 'dist/pages/index/index.js'), 'patched output')
      return observation(scenario, 'devtools')
    })
    await expect(verifyPublishedConsumer([root, '--disposable-consumer', '--runtime=devtools'])).rejects.toThrow('changed the published consumer artifacts')
    expect((await report(root)).status).toBe('failed')
  })
})
