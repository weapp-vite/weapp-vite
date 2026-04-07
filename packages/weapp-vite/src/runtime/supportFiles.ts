import type { ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../context'
import { readFile } from 'node:fs/promises'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fdir as Fdir } from 'fdir'
import { parse } from 'vue/compiler-sfc'
import { findAutoImportCandidates, shouldBootstrapAutoImportWithoutGlobs } from '../plugins/autoImport'
import { collectVueTemplateAutoImportTags } from '../plugins/hooks/useLoadEntry/loadEntry/template'
import { scanWxml } from '../wxml'
import { getAutoImportConfig } from './autoImport/config'
import { createManagedTsconfigFiles, syncManagedTsconfigFiles } from './tsconfigSupport'

export interface SyncSupportFilesResult {
  managedTsconfigChanged: boolean
}

async function hasManagedTsconfigChanges(ctx: MutableCompilerContext) {
  const files = await createManagedTsconfigFiles(ctx)

  for (const file of files) {
    const existing = await readFile(file.path, 'utf8').catch(() => undefined)
    if (existing !== file.content) {
      return true
    }
  }

  return false
}

async function collectAutoImportTemplateTags(ctx: MutableCompilerContext) {
  const srcRoot = ctx.configService?.absoluteSrcRoot
  if (!srcRoot) {
    return [] as Array<{ tag: string, importerBaseName: string }>
  }

  const files = await new Fdir({
    includeDirs: false,
    pathSeparator: '/',
  })
    .withFullPaths()
    .filter(filePath => filePath.endsWith('.vue') || filePath.endsWith('.wxml'))
    .crawl(srcRoot)
    .withPromise()

  const tags = new Map<string, string>()
  const platform = ctx.configService?.platform ?? 'weapp'

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8').catch(() => undefined)
    if (!source) {
      continue
    }

    if (filePath.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: filePath })
      if (errors.length > 0 || !descriptor.template?.content) {
        continue
      }
      for (const tag of collectVueTemplateAutoImportTags(descriptor.template.content, filePath)) {
        tags.set(tag, removeExtensionDeep(filePath))
      }
      continue
    }

    for (const tag of Object.keys(scanWxml(source, { platform }).components)) {
      tags.set(tag, removeExtensionDeep(filePath))
    }
  }

  return Array.from(tags.entries(), ([tag, importerBaseName]) => ({ tag, importerBaseName }))
}

export async function syncProjectSupportFiles(ctx: MutableCompilerContext): Promise<SyncSupportFilesResult> {
  const managedTsconfigChanged = await hasManagedTsconfigChanges(ctx)

  await syncManagedTsconfigFiles(ctx)

  if (ctx.autoRoutesService?.isEnabled()) {
    await ctx.autoRoutesService.ensureFresh()
  }

  const autoImportConfig = getAutoImportConfig(ctx.configService)
  if (autoImportConfig && ctx.autoImportService && ctx.configService) {
    await ctx.autoImportService.runInBatch(async () => {
      ctx.autoImportService!.reset()
      const globs = autoImportConfig.globs
      if (Array.isArray(globs) && globs.length > 0) {
        const files = await findAutoImportCandidates({
          ctx,
          resolvedConfig: {
            build: {
              outDir: ctx.configService.outDir,
            },
          } as ResolvedConfig,
        }, globs)
        await Promise.all(files.map(file => ctx.autoImportService!.registerPotentialComponent(file)))
      }
      else if (!shouldBootstrapAutoImportWithoutGlobs(autoImportConfig)) {
        // noop
      }

      const templateTags = await collectAutoImportTemplateTags(ctx)
      for (const { tag, importerBaseName } of templateTags) {
        ctx.autoImportService!.resolve(tag, importerBaseName)
      }

      ctx.autoImportService!.setSupportFileResolverComponents(
        ctx.autoImportService!.collectStaticResolverComponentsForSupportFiles(),
      )
    })
    try {
      await ctx.autoImportService.awaitManifestWrites()
    }
    finally {
      ctx.autoImportService.clearSupportFileResolverComponents()
    }
  }

  return {
    managedTsconfigChanged,
  }
}
