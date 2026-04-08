import type chokidar from 'chokidar'
import type { PackageJson } from 'pkg-types'

export type ChokidarWatchOptions = NonNullable<Parameters<typeof chokidar.watch>[1]>
export interface ConfigEnv {
  command: 'build' | 'serve'
  mode: string
}

export type UserConfigExport = Record<string, any> | Promise<Record<string, any>> | (() => Record<string, any> | Promise<Record<string, any>>)

export interface SidecarWatchOptionsInput {
  persistent?: boolean
  ignoreInitial?: boolean
  ignored?: ChokidarWatchOptions['ignored']
  awaitWriteFinish?: {
    stabilityThreshold?: number
    pollInterval?: number
  }
}

export declare function createSidecarWatchOptions(
  configService: {
    inlineConfig?: {
      build?: {
        watch?: unknown
      }
      server?: {
        watch?: {
          usePolling?: boolean
          interval?: number
          binaryInterval?: number
        }
      }
    }
  },
  input: SidecarWatchOptionsInput,
): ChokidarWatchOptions

export type WeappInjectRequestGlobalsTarget = 'fetch' | 'Headers' | 'Request' | 'Response' | 'AbortController' | 'AbortSignal' | 'XMLHttpRequest' | 'WebSocket'

export type RequestGlobalBindingTarget = WeappInjectRequestGlobalsTarget | 'URL' | 'URLSearchParams' | 'Blob' | 'FormData'

export interface ResolvedInjectRequestGlobalsOptions {
  mode: 'auto' | 'explicit'
  targets: WeappInjectRequestGlobalsTarget[]
  dependencyPatterns?: (string | RegExp)[]
}

export declare function resolveInjectRequestGlobalsOptions(
  config: boolean | {
    enabled?: boolean
    dependencies?: (string | RegExp)[]
    targets?: WeappInjectRequestGlobalsTarget[]
  } | undefined,
  packageJson: PackageJson | undefined,
): ResolvedInjectRequestGlobalsOptions | null

export declare function resolveRequestGlobalsBindingTargets(
  targets: WeappInjectRequestGlobalsTarget[],
): RequestGlobalBindingTarget[]

export declare function createRequestGlobalsPassiveBindingsCode(
  targets: WeappInjectRequestGlobalsTarget[],
): string

export declare function resolveTypedRouterOutputPath(configService: {
  cwd: string
  configFilePath?: string
}): string

export declare function resolvePersistentCacheBaseDir(configService: {
  cwd: string
  configFilePath?: string
}): string | undefined

export declare function loadViteConfigFile(
  configEnv: ConfigEnv,
  configFile: string | undefined,
  configRoot: string,
  configFileDependencies?: string[],
  configFileExport?: UserConfigExport,
  configLoader?: 'bundle' | 'runner' | 'native',
): Promise<unknown>
