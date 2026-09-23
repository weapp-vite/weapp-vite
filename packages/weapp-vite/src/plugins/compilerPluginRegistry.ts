import type { CompilerContext } from '../context'
import { normalizeFsResolvedId } from '../utils/resolvedId'

/**
 * 通用编译器 CSS 入口标记。使用重要注释以便通过 PostCSS/Vite 的中间处理，
 * 在 output 阶段再由 compiler host 移除，不把 provider 状态暴露到最终产物。
 */
const MANAGED_COMPILER_ENTRY_MARKER = '/*! weapp-vite managed-compiler-entry:1 */'
const MANAGED_COMPILER_OUTPUT_MARKER = '/*! weapp-vite managed-compiler-output:1 */'
const LEGACY_TAILWIND_OUTPUT_MARKER_PREFIX = '/*! weapp-vite managed-tailwindcss-output:'
const MANAGED_COMPILER_MARKER_RE = /\/\*! weapp-vite managed-compiler-(?:entry|output):1 \*\/\s*/g

interface CompilerOwnerState {
  entries: Set<string>
}

const registry = new WeakMap<CompilerContext, Map<string, CompilerOwnerState>>()

function normalized(id: string) {
  return normalizeFsResolvedId(id.split('?')[0], { stripLeadingNullByte: true })
}

function assertCompilerEntryOwnership(
  providers: Map<string, CompilerOwnerState>,
  provider: string,
  entries: string[],
) {
  for (const [existingProvider, state] of providers) {
    if (existingProvider === provider) {
      continue
    }
    const conflict = entries.find(entry => state.entries.has(entry))
    if (conflict) {
      throw new Error(`编译插件源码所有权冲突：\`${conflict}\` 已由 \`${existingProvider}\` 接管，无法再由 \`${provider}\` 接管。`)
    }
  }
}

export function registerManagedCompilerEntries(ctx: CompilerContext, provider: string, entries: string[]) {
  const normalizedEntries = entries.map(normalized)
  const providers = registry.get(ctx) ?? new Map<string, CompilerOwnerState>()
  assertCompilerEntryOwnership(providers, provider, normalizedEntries)
  providers.set(provider, { entries: new Set(normalizedEntries) })
  registry.set(ctx, providers)
}

export function addManagedCompilerEntry(ctx: CompilerContext, provider: string, entry: string) {
  const providers = registry.get(ctx) ?? new Map<string, CompilerOwnerState>()
  const normalizedEntry = normalized(entry)
  assertCompilerEntryOwnership(providers, provider, [normalizedEntry])
  const state = providers.get(provider) ?? { entries: new Set<string>() }
  state.entries.add(normalizedEntry)
  providers.set(provider, state)
  registry.set(ctx, providers)
}

export function hasManagedCompilerEntries(ctx: CompilerContext) {
  return Array.from(registry.get(ctx)?.values() ?? [], state => state.entries.size > 0).some(Boolean)
}

export function isManagedCompilerEntry(ctx: CompilerContext, id: string) {
  const target = normalized(id)
  return Array.from(registry.get(ctx)?.values() ?? [], state => state.entries.has(target)).some(Boolean)
}

export function isManagedCompilerEntryByProvider(ctx: CompilerContext, provider: string, id: string) {
  return registry.get(ctx)?.get(provider)?.entries.has(normalized(id)) === true
}

export function hasManagedCompilerEntriesByProvider(ctx: CompilerContext, provider: string) {
  return (registry.get(ctx)?.get(provider)?.entries.size ?? 0) > 0
}

export function createManagedCompilerEntryMarker() {
  return MANAGED_COMPILER_ENTRY_MARKER
}

export function hasManagedCompilerEntryMarker(css: string) {
  return css.includes(MANAGED_COMPILER_ENTRY_MARKER)
}

export function findManagedCompilerEntryMarker(css: string) {
  return css.indexOf(MANAGED_COMPILER_ENTRY_MARKER)
}

/**
 * 判断 CSS 是否仍由 compiler host 接管。旧 Tailwind output marker 也视为有效，
 * 这样迁移期间的 Tailwind 产物仍能走原有 sidecar 归属路径。
 */
export function hasManagedCompilerOutputMarker(css: string) {
  return css.includes(MANAGED_COMPILER_ENTRY_MARKER)
    || css.includes(MANAGED_COMPILER_OUTPUT_MARKER)
    || css.includes(LEGACY_TAILWIND_OUTPUT_MARKER_PREFIX)
}

export function stripManagedCompilerMarkers(css: string) {
  return css.replace(MANAGED_COMPILER_MARKER_RE, '')
}
