import type { PackageJson } from 'pkg-types'
import type { ChokidarWatchOptions, RequestGlobalBindingTarget, WeappInjectRequestGlobalsTarget } from '.'
import process from 'node:process'
import { expectAssignable, expectError, expectType } from 'tsd'
import { createRequestGlobalsPassiveBindingsCode, createSidecarWatchOptions, loadViteConfigFile, resolveInjectRequestGlobalsOptions, resolvePersistentCacheBaseDir, resolveRequestGlobalsBindingTargets, resolveTypedRouterOutputPath } from '.'

const watchOptions = createSidecarWatchOptions({
  inlineConfig: {
    build: {
      watch: {
        chokidar: {
          usePolling: true,
          interval: 120,
        },
      },
    },
    server: {
      watch: {
        binaryInterval: 240,
      },
    },
  },
} as any, {
  ignoreInitial: true,
  persistent: true,
  ignored: ['**/dist/**'],
  awaitWriteFinish: {
    stabilityThreshold: 80,
    pollInterval: 20,
  },
})

expectAssignable<ChokidarWatchOptions>(watchOptions)
expectType<ChokidarWatchOptions['ignored']>(watchOptions.ignored)

const packageJson: PackageJson = {
  dependencies: {
    axios: '^1.0.0',
  },
}
const injectOptions = resolveInjectRequestGlobalsOptions(true, packageJson)
if (injectOptions) {
  expectType<string>(createRequestGlobalsPassiveBindingsCode(injectOptions.targets))
  expectAssignable<RequestGlobalBindingTarget[]>(resolveRequestGlobalsBindingTargets(injectOptions.targets))
  expectAssignable<WeappInjectRequestGlobalsTarget[]>(injectOptions.targets)
}

const loadConfigLike = {
  cwd: '/repo',
  configFilePath: '/repo/vite.config.ts',
}
expectType<string>(resolveTypedRouterOutputPath(loadConfigLike))
expectType<string | undefined>(resolvePersistentCacheBaseDir(loadConfigLike))

const viteConfigLoad = loadViteConfigFile(
  { command: 'serve', mode: 'development' },
  undefined,
  process.cwd(),
  undefined,
  undefined,
  'runner',
)
expectType<Promise<unknown>>(viteConfigLoad)
expectError(loadViteConfigFile(
  { command: 'serve', mode: 'development' },
  undefined,
  process.cwd(),
  undefined,
  undefined,
  'invalid',
))
