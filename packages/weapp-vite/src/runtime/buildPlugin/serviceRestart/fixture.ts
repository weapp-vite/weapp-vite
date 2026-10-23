import type { Mock } from 'vitest'
import type { MutableCompilerContext } from '../../../context'
import type { DevModuleGraphChange } from '../../../moduleGraph/devProvider'
import { vi } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import { createWatcherServicePlugin } from '../../watcherPlugin'

interface FixtureMocks {
  build: Mock<(...args: unknown[]) => Promise<unknown>>
  provider: Mock<(ctx: unknown, options: unknown, onChange: (change: DevModuleGraphChange) => void) => Promise<unknown>>
  watch: Mock<(...args: unknown[]) => unknown>
  assets: Mock<(...args: unknown[]) => unknown>
  logger: Record<'info' | 'success' | 'error' | 'warn', Mock<(...args: unknown[]) => void>>
  restarts: Promise<void>[]
  forbiddenIo: Mock<(operation: string) => never>
}

const mocks: FixtureMocks = vi.hoisted(() => ({
  build: vi.fn(),
  provider: vi.fn(),
  watch: vi.fn(),
  assets: vi.fn(),
  logger: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
  restarts: [] as Promise<void>[],
  forbiddenIo: vi.fn((operation: string) => {
    throw new Error(`Pure mock regression attempted real IO: ${operation}`)
  }),
}))

export { mocks }

vi.mock('vite', () => ({ build: mocks.build }))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('../../../moduleGraph/devProvider', () => ({ createDevModuleGraphProvider: mocks.provider }))
vi.mock('../../watch/assets', () => ({ watchAssetSources: mocks.assets }))
vi.mock('../../../context/shared', () => ({ debug: vi.fn(), logger: mocks.logger }))
vi.mock('node:fs/promises', () => ({
  appendFile: (...args: unknown[]) => mocks.forbiddenIo(`appendFile:${args[0]}`),
  mkdir: (...args: unknown[]) => mocks.forbiddenIo(`mkdir:${args[0]}`),
}))
vi.mock('@weapp-core/shared/fs', () => ({
  fs: new Proxy({}, { get: (_target, key) => () => mocks.forbiddenIo(`fs.${String(key)}`) }),
}))
vi.mock('@weapp-core/shared/node', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-core/shared/node')>(),
  fs: new Proxy({}, { get: (_target, key) => () => mocks.forbiddenIo(`fs.${String(key)}`) }),
}))
vi.mock('../outputs', () => ({
  shouldCleanOutputs: () => false,
  cleanOutputs: () => mocks.forbiddenIo('cleanOutputs'),
  resetEmittedOutputCaches: vi.fn(),
  isOutputRootInsideOutDir: () => true,
}))
vi.mock('../../sharedBuildConfig', () => ({ createSharedBuildConfig: () => ({}) }))
vi.mock('../../supportFiles', () => ({
  syncProjectSupportFiles: async () => ({ managedTsconfigWarnings: [] }),
}))
vi.mock('../../../utils/projectConfig', () => ({
  disableProjectPrivateConfigHotReload: () => mocks.forbiddenIo('project private config'),
  syncProjectConfigToOutput: () => mocks.forbiddenIo('project output config'),
}))
vi.mock('../workers', () => ({
  checkWorkersOptions: () => ({ hasWorkersDir: false }),
}))
vi.mock('../touchAppWxss', () => ({
  resolveTouchAppWxssEnabled: () => false,
  touchExistingAppStyle: () => mocks.forbiddenIo('touch app style'),
}))
vi.mock('../independent', () => ({
  createIndependentBuilder: () => ({
    buildIndependentBundle: () => mocks.forbiddenIo('independent build'),
    getIndependentOutput: () => undefined,
    invalidateIndependentOutput: vi.fn(),
  }),
}))
vi.mock('../pluginProject', () => ({
  assertPluginProjectOutput: vi.fn(),
  setPluginProjectBuildOptions: vi.fn(),
  createPluginProjectSession: () => mocks.forbiddenIo('plugin project session'),
  isPluginProjectClosing: () => false,
  // 普通 app 没有插件 CompilerSession，正式实现直接调用 restart；这里仅登记任务以确定完成边界。
  runPluginProjectRestart: (_ctx: unknown, restart: () => Promise<void>) => {
    const task = restart()
    mocks.restarts.push(task)
    return task
  },
}))
vi.mock('../../statefulHmr/session', () => ({
  prepareStatefulClassicHandoff: () => mocks.forbiddenIo('stateful classic handoff'),
  runStatefulHmrDev: () => mocks.forbiddenIo('stateful dev'),
}))
vi.mock('../../statefulHmr/snapshotBuild', () => ({
  buildStatefulHmrSnapshot: () => mocks.forbiddenIo('stateful snapshot'),
}))

export function createContext() {
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      inlineConfig: {},
      weappViteConfig: { hmr: { runtime: 'classic' } },
      loadOptions: { cwd: '/project', isDev: true, mode: 'development' },
      load: vi.fn(async () => {}),
      merge: vi.fn((_meta: unknown, _inline: unknown, next: unknown) => next ?? {}),
      outDir: '/project/dist',
      outputExtensions: { wxss: 'wxss' },
      absoluteSrcRoot: '/project/src',
      relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
      relativeCwd: (id: string) => id.replace('/project/', ''),
      platform: 'weapp',
      multiPlatform: { enabled: false },
      packageJson: {},
      cwd: '/project',
      projectPrivateConfig: {},
      isDev: true,
      configFileDependencies: [] as string[],
    },
    npmService: { build: () => mocks.forbiddenIo('npm build') },
    scanService: {
      subPackageMap: new Map(),
      markDirty: vi.fn<(...args: unknown[]) => void>(),
      loadAppEntry: vi.fn(async () => {}),
      loadSubPackages: vi.fn(() => []),
      drainIndependentDirtyRoots: () => [],
    },
    moduleGraphService: {
      bindBuildContext: vi.fn<(...args: unknown[]) => void>(),
      bindPluginContext: vi.fn<(...args: unknown[]) => void>(),
      clearPendingChanges: vi.fn<(...args: unknown[]) => void>(),
      resetSession: vi.fn<(...args: unknown[]) => void>(),
      removeEntryDependencies: vi.fn<(...args: unknown[]) => void>(),
      collectAffectedEntries: () => new Set<string>(),
      hasModule: (_id: string) => false,
      isLogicalLayoutEntry: () => false,
      recordChangedFile: vi.fn<(...args: unknown[]) => void>(),
    },
  }
  createWatcherServicePlugin(ctx as unknown as MutableCompilerContext)
  return ctx as typeof ctx & { watcherService: NonNullable<MutableCompilerContext['watcherService']> }
}
