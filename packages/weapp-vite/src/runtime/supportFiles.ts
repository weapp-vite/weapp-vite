import type { ResolvedConfig } from 'vite'
import type { CompilerContext, MutableCompilerContext } from '../context'
import { readFile } from 'node:fs/promises'
import { removeExtensionDeep } from '@weapp-core/shared'
import { parse as parseJson } from 'comment-json'
import { fdir as Fdir } from 'fdir'
import { parse } from 'vue/compiler-sfc'
import { resolveMiniPlatformWithDefault } from '../platform'
import { createAutoImportGlobsKey, findAutoImportCandidates, shouldBootstrapAutoImportWithoutGlobs } from '../plugins/autoImport'
import { collectVueTemplateAutoImportTags } from '../plugins/hooks/useLoadEntry/loadEntry/template'
import { scanWxml } from '../wxml'
import { getAutoImportConfig } from './autoImport/config'
import { createManagedTsconfigFiles, syncManagedTsconfigFiles } from './tsconfigSupport'
import { requireConfigService } from './utils/requireConfigService'

export interface SyncSupportFilesResult {
  managedTsconfigChanged: boolean
  managedTsconfigWarnings: string[]
}

export interface SyncProjectSupportFilesOptions {
  syncAutoImport?: boolean
}

interface ManagedTsconfigInspection {
  files: Awaited<ReturnType<typeof createManagedTsconfigFiles>>
  managedTsconfigChanged: boolean
  managedTsconfigWarnings: string[]
}

function parseJsonObject(content: string | undefined) {
  if (!content) {
    return undefined
  }

  try {
    const parsed = parseJson(content, undefined, true)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  }
  catch {
    return undefined
  }
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getExpectedAppSrcInclude(expectedAppTsconfig: Record<string, unknown> | undefined) {
  return readStringArray(expectedAppTsconfig?.include)[0]
}

function createManagedTsconfigWarnings(
  ctx: MutableCompilerContext,
  expectedAppContent: string | undefined,
  existingAppContent: string | undefined,
) {
  const expectedAppTsconfig = parseJsonObject(expectedAppContent)
  const existingAppTsconfig = parseJsonObject(existingAppContent)
  const expectedSrcInclude = getExpectedAppSrcInclude(expectedAppTsconfig)
  const existingIncludes = readStringArray(existingAppTsconfig?.include)

  if (!existingAppContent || !expectedSrcInclude || existingIncludes.includes(expectedSrcInclude)) {
    return []
  }

  const srcRoot = ctx.configService?.srcRoot ?? 'src'
  const existingSrcIncludes = existingIncludes.filter(include => include.endsWith('/**/*'))
  const existingText = existingSrcIncludes.length > 0
    ? `当前为 ${existingSrcIncludes.map(include => `\`${include}\``).join('、')}`
    : '当前未包含源码目录'

  return [
    `[prepare] 检测到 .weapp-vite/tsconfig.app.json include 与 weapp.srcRoot 不匹配：srcRoot 为 \`${srcRoot}\`，期望包含 \`${expectedSrcInclude}\`，${existingText}。已自动重新生成支持文件并使用最新配置继续运行。`,
  ]
}

async function inspectManagedTsconfigFiles(ctx: MutableCompilerContext): Promise<ManagedTsconfigInspection> {
  const files = await createManagedTsconfigFiles(ctx)
  let expectedAppContent: string | undefined
  let existingAppContent: string | undefined

  const inspections = await Promise.all(files.map(async (file) => {
    return {
      existing: await readFile(file.path, 'utf8').catch(() => undefined),
      file,
    }
  }))
  const managedTsconfigChanged = inspections.some(({ existing, file }) => existing !== file.content)

  for (const { existing, file } of inspections) {
    if (file.path.endsWith('tsconfig.app.json')) {
      expectedAppContent = file.content
      existingAppContent = existing
    }
  }

  return {
    files,
    managedTsconfigChanged,
    managedTsconfigWarnings: createManagedTsconfigWarnings(ctx, expectedAppContent, existingAppContent),
  }
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
  const platform = resolveMiniPlatformWithDefault(ctx.configService?.platform)

  await Promise.all(files.map(async (filePath) => {
    const source = await readFile(filePath, 'utf8').catch(() => undefined)
    if (!source) {
      return
    }

    if (filePath.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename: filePath })
      if (errors.length > 0 || !descriptor.template?.content) {
        return
      }
      for (const tag of collectVueTemplateAutoImportTags(descriptor.template.content, filePath)) {
        tags.set(tag, removeExtensionDeep(filePath))
      }
      return
    }

    for (const tag of Object.keys(scanWxml(source, { platform }).components)) {
      tags.set(tag, removeExtensionDeep(filePath))
    }
  }))

  return Array.from(tags.entries(), ([tag, importerBaseName]) => ({ tag, importerBaseName }))
}

export async function syncProjectSupportFiles(
  ctx: MutableCompilerContext,
  options: SyncProjectSupportFilesOptions = {},
): Promise<SyncSupportFilesResult> {
  const configService = requireConfigService(ctx, '同步 support files 前必须初始化 configService。')
  const managedTsconfigInspection = await inspectManagedTsconfigFiles(ctx)

  await syncManagedTsconfigFiles(ctx, managedTsconfigInspection.files)

  if (ctx.autoRoutesService?.isEnabled()) {
    await ctx.autoRoutesService.ensureFresh()
  }

  const syncAutoImport = options.syncAutoImport ?? true
  const autoImportConfig = syncAutoImport ? getAutoImportConfig(ctx.configService) : undefined
  if (autoImportConfig && ctx.autoImportService && ctx.configService) {
    await ctx.autoImportService.runInBatch(async () => {
      ctx.autoImportService!.reset()
      const globs = autoImportConfig.globs
      if (Array.isArray(globs) && globs.length > 0) {
        const autoImportCtx = {
          ...ctx,
          configService,
        } as CompilerContext
        const files = await findAutoImportCandidates({
          ctx: autoImportCtx,
          resolvedConfig: {
            build: {
              outDir: configService.outDir,
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
      ctx.runtimeState.autoImport.preparedGlobsKey = createAutoImportGlobsKey(globs)
    })
    try {
      await ctx.autoImportService.awaitManifestWrites()
    }
    finally {
      ctx.autoImportService.clearSupportFileResolverComponents()
    }
  }
  else if (ctx.runtimeState?.autoImport) {
    ctx.runtimeState.autoImport.preparedGlobsKey = undefined
  }

  return {
    managedTsconfigChanged: managedTsconfigInspection.managedTsconfigChanged,
    managedTsconfigWarnings: managedTsconfigInspection.managedTsconfigWarnings,
  }
}
