import type { WatcherFileWatcherOptions, WatcherOptions } from 'rolldown'
import type { ServerWatchOptions, UserConfig as ViteUserConfig } from 'vite'
import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd'
import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

type PublicUserConfig = ViteUserConfig

type BuildWatchOptions = NonNullable<NonNullable<ViteUserConfig['build']>['watch']>
type SidecarOptions = NonNullable<BuildWatchOptions['chokidar']>
type SidecarOptionName = 'backend' | 'pollingInterval' | 'pollingBinaryInterval' | 'usePolling' | 'interval' | 'binaryInterval'

declare const sidecarOptionName: keyof SidecarOptions
declare const sidecarOptions: SidecarOptions
declare const rolldownWatch: WatcherOptions
declare const buildWatch: BuildWatchOptions

expectType<SidecarOptionName>(sidecarOptionName)
expectType<'auto' | 'native' | 'native-recursive' | 'polling' | undefined>(sidecarOptions.backend)
expectType<number | undefined>(sidecarOptions.pollingInterval)
expectType<number | undefined>(sidecarOptions.pollingBinaryInterval)
expectType<boolean | undefined>(sidecarOptions.usePolling)
expectType<number | undefined>(sidecarOptions.interval)
expectType<number | undefined>(sidecarOptions.binaryInterval)

// 同时检查原接口与 Vite 的引用，防止补充声明遮蔽上游 re-export alias。
expectType<WatcherFileWatcherOptions | undefined>(rolldownWatch.watcher)
expectType<string | RegExp | (string | RegExp)[] | undefined>(rolldownWatch.include)
expectType<((id: string) => void) | undefined>(rolldownWatch.onInvalidate)
expectType<WatcherFileWatcherOptions | undefined>(buildWatch.watcher)
expectType<string | RegExp | (string | RegExp)[] | undefined>(buildWatch.include)
expectType<((id: string) => void) | undefined>(buildWatch.onInvalidate)
expectType<number | undefined>(buildWatch.watcher?.pollInterval)

const explicitConfig = {
  plugins: [weapp()],
  weapp: { platform: 'weapp' },
  build: {
    watch: {
      chokidar: {
        backend: 'native-recursive',
        pollingInterval: 25,
        pollingBinaryInterval: 50,
      },
      watcher: {
        usePolling: true,
        pollInterval: 100,
        compareContentsForPolling: true,
      },
      include: ['src/**', /\.vue$/],
      exclude: 'dist/**',
      buildDelay: 10,
      clearScreen: false,
      skipWrite: false,
      onInvalidate(id) {
        expectType<string>(id)
      },
    },
  },
} satisfies ViteUserConfig

expectAssignable<PublicUserConfig>(explicitConfig)
defineConfig(explicitConfig)
defineConfig(Promise.resolve(explicitConfig))

const typedConfig: PublicUserConfig = {
  build: { watch: { chokidar: { backend: 'polling', pollingInterval: 80 } } },
}
defineConfig(typedConfig)

defineConfig(({ mode }) => ({
  plugins: [weapp()],
  weapp: { platform: 'weapp' },
  build: {
    watch: {
      chokidar: { backend: mode === 'development' ? 'polling' : 'native', pollingInterval: 100 },
      include: 'src/**',
      onInvalidate(id) {
        expectType<string>(id)
      },
    },
  },
}))

defineConfig(async ({ mode }) => ({
  plugins: [weapp()],
  weapp: { platform: 'weapp' },
  build: { watch: mode === 'production' ? null : { chokidar: { backend: 'auto' }, watcher: { pollInterval: 100 } } },
}))

defineConfig({ build: { watch: null } })
expectAssignable<PublicUserConfig>({ build: { watch: null } })
expectAssignable<SidecarOptions>({ backend: 'auto' })
expectAssignable<SidecarOptions>({ backend: 'native' })
expectAssignable<SidecarOptions>({ backend: 'native-recursive' })
expectAssignable<SidecarOptions>({ backend: 'polling' })
expectAssignable<SidecarOptions>({ usePolling: true, interval: 100, binaryInterval: 200 })

expectNotAssignable<SidecarOptions>({ backend: 'recursive' })
expectNotAssignable<SidecarOptions>({ pollingInterval: '100' })
expectNotAssignable<SidecarOptions>({ pollingBinaryInterval: '200' })
expectNotAssignable<SidecarOptions>({ usePolling: 'yes' })
expectNotAssignable<SidecarOptions>({ interval: '100' })
expectNotAssignable<SidecarOptions>({ binaryInterval: '200' })
expectError(({ backend: 'polling', ignored: ['dist/**'] }) satisfies SidecarOptions)
expectNotAssignable<BuildWatchOptions>({ watcher: { pollInterval: '100' } })
expectNotAssignable<BuildWatchOptions>({ include: 123 })
expectNotAssignable<BuildWatchOptions>({ onInvalidate: (_id: number) => {} })
expectError(defineConfig({ build: { watch: { chokidar: { backend: 'recursive' } } } }))
expectError(defineConfig({ build: { watch: { chokidar: { pollingInterval: '100' } } } }))
expectError(defineConfig(() => ({ build: { watch: { include: 'src/**', chokidar: { backend: 'recursive' } } } })))

// server.watch 仍属于 Vite 内置监听器，不公开 Chokidar 6 的 sidecar 字段。
const serverWatch = {
  usePolling: true,
  interval: 100,
  binaryInterval: 200,
  pollInterval: 100,
  compareContentsForPolling: true,
} satisfies ServerWatchOptions
defineConfig({ server: { watch: serverWatch } })
expectError(({ usePolling: true, backend: 'polling' }) satisfies ServerWatchOptions)
expectError(({ interval: 100, pollingInterval: 100 }) satisfies ServerWatchOptions)
expectError(({ binaryInterval: 200, pollingBinaryInterval: 200 }) satisfies ServerWatchOptions)
