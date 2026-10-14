import type { LogicalEntryType } from '../../../../moduleGraph/protocol'
import type { ResolveEntryPathOptions } from '../../../../utils/entryResolve'
import type { CorePluginState } from '../../helpers'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { getSelectedAutoRouteSource } from '../../../../runtime/autoRoutesPlugin/selection'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../../utils/entryResolve'

// eslint-disable-next-line regexp/no-super-linear-backtracking -- import 语法需要兼容默认、命名和副作用导入。
const LOCAL_IMPORT_RE = /\bimport\s+(?:([\s\S]*?)\s+from\s+)?(['"])([^'"\n]+)\2/g
const PAGE_IMPORT_BATCH_SIZE = 8

async function collectPageImports(
  state: CorePluginState,
  entry: string,
  entryResolveOptions: ResolveEntryPathOptions,
  absoluteSrcRoot: string,
) {
  const pageBase = path.resolve(absoluteSrcRoot, entry)
  const pageSource = getSelectedAutoRouteSource(state.ctx, pageBase)
    ?? (path.extname(pageBase) ? pageBase : await resolveEntryPath(pageBase, entryResolveOptions))
  if (!pageSource || !await fs.pathExists(pageSource)) {
    return []
  }
  let source: string
  try {
    source = await fs.readFile(pageSource, 'utf8')
  }
  catch {
    return []
  }
  const importedComponents: string[] = []
  for (const match of source.matchAll(LOCAL_IMPORT_RE)) {
    const importSource = match[3]
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      continue
    }
    const importedBase = path.resolve(path.dirname(pageSource), importSource)
    const kind = /^[{*]/.test(match[1]?.trim() ?? '') ? 'named' : 'default'
    const importedVue = importedBase.endsWith('.vue')
      ? importedBase
      : await resolveEntryPath(importedBase, { ...entryResolveOptions, kind })
    if (!importedVue?.endsWith('.vue') || !await fs.pathExists(importedVue)) {
      continue
    }
    const relativeEntry = path.relative(absoluteSrcRoot, importedVue).replaceAll('\\', '/')
    if (relativeEntry && !relativeEntry.startsWith('../')) {
      importedComponents.push(relativeEntry)
    }
  }
  return importedComponents
}

export async function collectImportedVueComponents(
  state: CorePluginState,
  candidates: Array<{ entry: string, type: LogicalEntryType }>,
) {
  const { configService } = state.ctx
  const { absoluteSrcRoot } = configService
  const entryResolveOptions = createCachedEntryResolveOptions(configService, { kind: 'default' })
  const pages = candidates.filter(candidate => candidate.type === 'page' && !candidate.entry.includes(':'))
  const importedComponents = new Set<string>()
  for (let offset = 0; offset < pages.length; offset += PAGE_IMPORT_BATCH_SIZE) {
    const batch = pages.slice(offset, offset + PAGE_IMPORT_BATCH_SIZE)
    // 全部任务终结后按声明顺序归并和传播首错，不让较快页面改变逻辑入口顺序。
    const results = await Promise.allSettled(batch.map(candidate => collectPageImports(state, candidate.entry, entryResolveOptions, absoluteSrcRoot)))
    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason
      }
      for (const entry of result.value) {
        importedComponents.add(entry)
      }
    }
  }
  return [...importedComponents]
}
