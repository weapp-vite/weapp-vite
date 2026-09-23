import type { CompilerContext, MutableCompilerContext } from '../context'
import fs from 'node:fs'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { hasManagedCompilerEntriesByProvider, isManagedCompilerEntry, isManagedCompilerEntryByProvider, registerManagedCompilerEntries } from './compilerPluginRegistry'

const MANAGED_TAILWINDCSS_ENTRY_MARKER_PREFIX = '.__weapp_vite_managed_tailwindcss_entry_'
const MANAGED_TAILWINDCSS_ENTRY_MARKER_SUFFIX = '__{--weapp-vite-managed-tailwindcss-entry:1}'
const MANAGED_TAILWINDCSS_OUTPUT_MARKER_PREFIX = '/*! weapp-vite managed-tailwindcss-output:'
const MANAGED_TAILWINDCSS_OUTPUT_MARKER_RE = /\/\*! weapp-vite managed-tailwindcss-output:\d+ \*\/\s*/g

export function normalizeManagedTailwindcssEntryPath(id: string) {
  const normalized = normalizeFsResolvedId(id)
  try {
    return normalizeFsResolvedId(fs.realpathSync.native(normalized))
  }
  catch {
    return normalized
  }
}

export function registerManagedTailwindcssEntries(ctx: CompilerContext, entries: string[]) {
  registerManagedCompilerEntries(ctx, 'tailwindcss', entries.map(normalizeManagedTailwindcssEntryPath))
}

export function hasManagedTailwindcssEntries(ctx: MutableCompilerContext) {
  return hasManagedCompilerEntriesByProvider(ctx as CompilerContext, 'tailwindcss')
}

export function isManagedTailwindcssEntry(ctx: CompilerContext, id: string) {
  return isManagedCompilerEntryByProvider(ctx, 'tailwindcss', normalizeManagedTailwindcssEntryPath(id))
}

export { isManagedCompilerEntry }

export function createManagedTailwindcssEntryMarker(index: number) {
  return `${MANAGED_TAILWINDCSS_ENTRY_MARKER_PREFIX}${index}${MANAGED_TAILWINDCSS_ENTRY_MARKER_SUFFIX}`
}

export function findManagedTailwindcssEntryMarker(css: string) {
  return css.indexOf(MANAGED_TAILWINDCSS_ENTRY_MARKER_PREFIX)
}

export function createManagedTailwindcssOutputMarker(index: number) {
  return `${MANAGED_TAILWINDCSS_OUTPUT_MARKER_PREFIX}${index} */`
}

export function hasManagedTailwindcssOutputMarker(css: string) {
  return css.includes(MANAGED_TAILWINDCSS_OUTPUT_MARKER_PREFIX)
}

export function stripManagedTailwindcssOutputMarkers(css: string) {
  return css.replace(MANAGED_TAILWINDCSS_OUTPUT_MARKER_RE, '')
}
