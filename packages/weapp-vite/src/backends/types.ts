import type { InlineConfig } from 'vite'
import type { CompilerContext } from '../context'
import type { BuildOptions } from '../runtime/buildPlugin'
import type { WeappVitePlatform, WeappViteRuntime } from '../runtimeTarget'

export interface PlatformBackendCapabilities {
  build: boolean
  dev: boolean
  ide: boolean
  analyze: boolean
  npm: boolean
  workers: boolean
  lib: boolean
}

export type PlatformBackendCapability = keyof PlatformBackendCapabilities

export interface PlatformBackendDescriptor {
  id: string
  aliases: readonly string[]
  runtime: WeappViteRuntime
  capabilities: Readonly<PlatformBackendCapabilities>
}

export interface ResolvedPlatformBackend {
  descriptor: PlatformBackendDescriptor
  driver: PlatformBackendDriver
  platform?: WeappVitePlatform
}

export interface ResolvedBackendExecution {
  kind: WeappViteRuntime | 'all'
  label: string
  raw?: string
  entries: readonly ResolvedPlatformBackend[]
  get: (backendId: string) => ResolvedPlatformBackend | undefined
  has: (capability: PlatformBackendCapability) => boolean
  select: (capability: PlatformBackendCapability) => readonly ResolvedPlatformBackend[]
}

export interface PlatformBackendInlineConfigOptions {
  execution: ResolvedBackendExecution
  platform?: WeappVitePlatform
  scope?: string
  host?: string | boolean
}

export interface PlatformBackendMergeContext {
  merge: (...configs: Partial<InlineConfig | undefined>[]) => InlineConfig | undefined
}

export interface PlatformBackendDriver {
  createInlineConfig: (options: PlatformBackendInlineConfigOptions) => InlineConfig | undefined
  mergeConfig: (
    context: PlatformBackendMergeContext,
    ...configs: Partial<InlineConfig | undefined>[]
  ) => InlineConfig | undefined
  build: (ctx: CompilerContext, options?: BuildOptions) => Promise<unknown>
  dev: (ctx: CompilerContext, options?: BuildOptions) => Promise<unknown>
  close: (ctx: CompilerContext) => Promise<void> | void
  resolvePlatformAlias?: (input: string) => WeappVitePlatform | undefined
}

export interface PlatformBackend {
  descriptor: PlatformBackendDescriptor
  driver: PlatformBackendDriver
}
