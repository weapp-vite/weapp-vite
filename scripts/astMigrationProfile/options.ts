import type { CompileVueFileOptions } from '../../packages-runtime/wevu-compiler/src/index'
import type { ProfileCase } from './types'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { resolveConfig } from 'vite'
import { createCompilerContextInstance } from '../../packages/weapp-vite/src/context/createCompilerContextInstance'
import { createCompileVueFileOptions } from '../../packages/weapp-vite/src/plugins/vue/transform/compileOptions'

export async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (['node_modules', 'dist', '.weapp-vite', '.tmp', '.git'].includes(entry.name)) {
      continue
    }
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(filename))
    }
    else if (entry.isFile()) {
      files.push(filename)
    }
  }
  return files
}

/** 使用真实项目配置、生产 options 工厂和 Vite 文件解析；不启动 server/watch 或写支持文件。 */
export async function createRealCompileOptions(root: string, fixture: ProfileCase, sourceMap: boolean) {
  const cwd = path.join(root, fixture.project)
  const filename = path.join(cwd, fixture.file)
  const env = { command: sourceMap ? 'serve' : 'build', mode: sourceMap ? 'development' : 'production' } as const
  const ctx = createCompilerContextInstance()
  await ctx.configService.load({
    cwd,
    isDev: sourceMap,
    cliPlatform: 'weapp',
    mode: env.mode,
    emitDefaultAutoImportOutputs: false,
    configFile: fixture.config,
    inlineConfig: { root: cwd, build: { sourcemap: sourceMap } },
  })
  const resolved = await resolveConfig({ ...ctx.configService.inlineConfig, configFile: false, plugins: [] }, env.command, env.mode)
  const resolver = resolved.createResolver()
  const pluginCtx = { resolve: async (source: string, importer?: string) => {
    const id = await resolver(source, importer)
    return id ? { id } : null
  } }
  const componentsRoot = path.join(ctx.configService.absoluteSrcRoot, 'components')
  await ctx.autoImportService.runWithoutOutputWrites(async () => {
    let files: string[] = []
    try {
      files = await listSourceFiles(componentsRoot)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
    for (const file of files.filter(file => file.endsWith('.vue') && file !== filename)) {
      await ctx.autoImportService.registerPotentialComponent(file)
    }
  })
  const options: CompileVueFileOptions = createCompileVueFileOptions(
    ctx,
    pluginCtx,
    filename,
    fixture.isPage,
    false,
    ctx.configService,
    { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false }, componentMetaCache: new Map(), emitResolvedComponentEntries: false },
  )
  const manifestOptions = {
    platform: ctx.configService.platform,
    isPage: options.isPage,
    isApp: options.isApp,
    skipComponentTransform: options.skipComponentTransform,
    minify: options.minify,
    sourceMap: options.sourceMap,
    runtimeBindingManifest: options.runtimeBindingManifest,
    template: options.template,
    json: options.json,
    wevuDefaults: options.wevuDefaults,
    resolver: 'production config service runner + createCompileVueFileOptions + Vite createResolver + project auto-import registry; excludes custom plugin resolveId hooks',
  }
  return { options, manifestOptions }
}
