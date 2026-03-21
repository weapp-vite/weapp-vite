import type { CompilerContext } from '../../../../context'
import { normalizeWatchPath } from '../../../../utils/path'
import { emitNativeLayoutScriptChunkIfNeeded } from '../bundle'
import { collectNativeLayoutAssets, resolvePageLayoutPlan } from '../pageLayout'

const APP_ENTRY_RE = /[\\/]app\.(?:vue|jsx|tsx)$/

export function resolveScriptlessVueEntryStub(isPage: boolean) {
  return isPage ? 'Page({})' : 'Component({})'
}

export function isAppEntry(filename: string) {
  return APP_ENTRY_RE.test(filename)
}

export function registerVueTemplateToken(
  ctx: CompilerContext,
  filename: string,
  template: string | undefined,
) {
  if (!template) {
    return
  }

  const wxmlService = (ctx as Partial<CompilerContext>).wxmlService
  if (!wxmlService) {
    return
  }

  try {
    const token = wxmlService.analyze(template)
    wxmlService.tokenMap.set(filename, token)
    wxmlService.setWxmlComponentsMap(filename, token.components)
  }
  catch {
    // 忽略模板扫描异常，避免阻断 Vue 编译流程
  }
}

export async function registerNativeLayoutChunksForEntry(
  pluginCtx: any,
  ctx: CompilerContext,
  filename: string,
  source: string,
) {
  const configService = ctx.configService
  if (!configService) {
    return
  }

  const resolvedLayoutPlan = await resolvePageLayoutPlan(source, filename, configService)
  if (!resolvedLayoutPlan) {
    return
  }

  if (typeof pluginCtx.addWatchFile === 'function') {
    for (const layout of resolvedLayoutPlan.layouts) {
      pluginCtx.addWatchFile(normalizeWatchPath(layout.file))
      if (layout.kind === 'native') {
        const nativeAssets = await collectNativeLayoutAssets(layout.file)
        for (const asset of Object.values(nativeAssets)) {
          if (asset) {
            pluginCtx.addWatchFile(normalizeWatchPath(asset))
          }
        }
      }
    }
  }

  for (const layout of resolvedLayoutPlan.layouts) {
    if (layout.kind !== 'native') {
      continue
    }
    await emitNativeLayoutScriptChunkIfNeeded({
      pluginCtx,
      layoutBasePath: layout.file,
      configService,
      outputExtensions: configService.outputExtensions,
    })
  }
}
