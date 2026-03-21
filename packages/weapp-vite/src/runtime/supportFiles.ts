import type { ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../context'
import { readFile } from 'node:fs/promises'
import { findAutoImportCandidates, shouldBootstrapAutoImportWithoutGlobs } from '../plugins/autoImport'
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

export async function syncProjectSupportFiles(ctx: MutableCompilerContext): Promise<SyncSupportFilesResult> {
  const managedTsconfigChanged = await hasManagedTsconfigChanges(ctx)

  await syncManagedTsconfigFiles(ctx)

  if (ctx.autoRoutesService?.isEnabled()) {
    await ctx.autoRoutesService.ensureFresh()
  }

  const autoImportConfig = getAutoImportConfig(ctx.configService)
  if (autoImportConfig && ctx.autoImportService && ctx.configService) {
    ctx.autoImportService.reset()
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

    await ctx.autoImportService.awaitManifestWrites()
  }

  return {
    managedTsconfigChanged,
  }
}
