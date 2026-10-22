import type { CompilerContext } from '../../../context'
import type { ChangeEvent } from '../../../types'
import type { VueEntryUpdateInspector } from './vueEntryUpdate'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { findCssEntry } from '../../../utils/file'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { ownsCompilerContentSource } from '../../compilerPlugin/contentSources'
import { isManagedCompilerEntry } from '../../compilerPluginRegistry'
import { getManagedTailwindcssEntries, isManagedTailwindcssEntry } from '../../tailwindcssMarker'
import { configSuffixes, watchedScriptModuleSuffixes, watchedTemplateExts } from '../../utils/invalidateEntry/shared'
import { createVueEntryUpdateInspector } from './vueEntryUpdate'

const compilerContentExtensions = new Set([
  '.vue',
  ...watchedTemplateExts,
  ...watchedScriptModuleSuffixes,
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
])
const TAILWIND_APP_STYLE_RE = /@import\s+['"]tailwindcss['"]|@tailwind\s+(?:base|components|utilities)\b|weapp-tailwindcss|tailwindcss\/vite/

export interface CompilerContentOwner {
  appEntryId: string
  styles: Array<{ path: string, tailwindcss: boolean, compiler: boolean }>
}

export interface CompilerContentUpdate {
  appEntryId: string
  reason: 'tailwind-content' | 'compiler-content'
}

export function isCompilerContentSource(id: string, config?: CompilerContext['configService']) {
  return (compilerContentExtensions.has(path.extname(id)) && !configSuffixes.some(suffix => id.endsWith(suffix)))
    || Boolean(config && ownsCompilerContentSource(config, id))
}

/** 入口身份与 provider 所有权属于当前配置代际，源码判断可随后在冻结输入内进行。 */
export async function resolveCompilerContentOwner(ctx: CompilerContext, sourceId?: string): Promise<CompilerContentOwner | undefined> {
  let appEntry = ctx.scanService.appEntry
  if (!appEntry) {
    try {
      appEntry = await ctx.scanService.loadAppEntry()
    }
    catch {
      return undefined
    }
  }
  if (!appEntry?.path) {
    return undefined
  }
  const appEntryId = normalizeFsResolvedId(appEntry.path)
  if (appEntryId === sourceId) {
    return undefined
  }
  const styleEntry = await findCssEntry(appEntryId, ctx.configService.platform)
  const stylePaths = styleEntry.path ? [styleEntry.path] : getManagedTailwindcssEntries(ctx)
  return {
    appEntryId,
    styles: stylePaths.map(stylePath => ({
      path: stylePath,
      tailwindcss: isManagedTailwindcssEntry(ctx, stylePath),
      compiler: isManagedCompilerEntry(ctx, stylePath),
    })),
  }
}

/** watch 与一次性 snapshot 共用内容语义；调用方决定读取实时源码或本代冻结输入。 */
export async function resolveCompilerContentUpdate(
  ctx: CompilerContext,
  normalizedId: string,
  event: ChangeEvent,
  options: {
    inspector?: VueEntryUpdateInspector
    owner?: CompilerContentOwner | null
    readFile?: (file: string) => Promise<string>
  } = {},
): Promise<CompilerContentUpdate | undefined> {
  if ((event !== 'update' && event !== 'create' && event !== 'delete') || !isCompilerContentSource(normalizedId, ctx.configService)) {
    return undefined
  }
  const readFile = options.readFile ?? (file => fs.readFile(file, 'utf8'))
  const inspector = options.inspector ?? (normalizedId.endsWith('.vue')
    ? createVueEntryUpdateInspector({ ctx }, normalizedId, { readFile })
    : undefined)
  if (inspector) {
    const genericProviders = Object.keys(ctx.runtimeState.build.hmr.vueEntryContentSignatures?.get(normalizedId) ?? {})
      .filter(provider => provider !== 'tailwindcss')
    if (genericProviders.length) {
      const changes = await Promise.all(genericProviders.map(provider => inspector.isCompilerContentUpdate(provider)))
      if (!changes.some(Boolean)) {
        return undefined
      }
    }
    else if (!await inspector.isTailwindContentUpdate()) {
      return undefined
    }
  }
  const owner = options.owner === undefined ? await resolveCompilerContentOwner(ctx, normalizedId) : options.owner
  if (!owner || owner.appEntryId === normalizedId) {
    return undefined
  }
  const ownership = await Promise.all(owner.styles.map(async (style) => {
    let tailwindcss = style.tailwindcss
    try {
      const source = await readFile(style.path)
      tailwindcss ||= TAILWIND_APP_STYLE_RE.test(source)
    }
    catch {
      // 未受管样式读取失败不构成编译器所有权，原生构建继续负责实际输入错误。
    }
    return { tailwindcss, compiler: style.compiler }
  }))
  if (!ownership.some(style => style.tailwindcss || style.compiler)) {
    return undefined
  }
  return {
    appEntryId: owner.appEntryId,
    reason: ownership.some(style => style.tailwindcss) ? 'tailwind-content' : 'compiler-content',
  }
}
