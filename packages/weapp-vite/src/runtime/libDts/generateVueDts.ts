import type { VueCompilerOptions } from '@vue/language-core'
import type { ConfigService } from '../config/types'
import type { ResolvedWeappLibEntry } from '../lib'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared'
import { resolveModule } from 'local-pkg'
import path from 'pathe'
import { getVueCompilerLibOrUndefined, rewriteVueComponentTypeToWevu, shouldRewriteWevuComponentType } from './rewriteWevuComponent'
import { ensureModuleResolution, isDtsMapOutputFile, isDtsOutputFile, normalizePath, replaceSourceMappingUrl, resolveInternalTsconfig, resolveRelativeBase, resolveVueSourceFile, runVueTsc } from './shared'

const FILE_EXTENSION_RE = /\.[^.]+$/

export async function generateVueDtsWithVueTsc(
  configService: ConfigService,
  libConfig: NonNullable<ConfigService['weappLibConfig']>,
  vueEntries: ResolvedWeappLibEntry[],
  dtsOptions: NonNullable<ConfigService['weappLibConfig']>['dts'],
) {
  const ts = await import('typescript') as typeof import('typescript')
  const vueTscPkg = resolveModule('vue-tsc/package.json', { paths: [configService.cwd, process.cwd()] })
  if (!vueTscPkg) {
    throw new Error('[lib] 生成 Vue SFC 的 dts 需要安装 vue-tsc，请先安装后重试。')
  }
  const vueTscBin = path.resolve(path.dirname(vueTscPkg), 'bin/vue-tsc.js')
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-dts-'))
  const tempOutDir = path.join(tempRoot, 'out')
  const tsconfigPath = path.join(tempRoot, 'tsconfig.json')
  let libRoot = libConfig.root || configService.absoluteSrcRoot
  const hasEntryOutsideRoot = vueEntries.some((entry) => {
    const relative = path.relative(libRoot, entry.input)
    return relative.startsWith('..') || path.isAbsolute(relative)
  })
  if (hasEntryOutsideRoot) {
    libRoot = configService.cwd
  }

  const baseVueTsconfig: {
    compilerOptions: import('typescript').CompilerOptions
    files: string[]
    include: string[]
    vueCompilerOptions: Partial<VueCompilerOptions>
  } = {
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      outDir: tempOutDir,
      declarationDir: tempOutDir,
      rootDir: libRoot,
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    files: vueEntries.map(entry => entry.input),
    include: vueEntries.map(entry => entry.input),
    vueCompilerOptions: {
      lib: 'wevu',
    },
  }
  const vueTscOptions = dtsOptions?.vueTsc
  const vueTsconfig = {
    ...baseVueTsconfig,
    ...vueTscOptions?.tsconfig,
    compilerOptions: {
      ...baseVueTsconfig.compilerOptions,
      ...vueTscOptions?.compilerOptions,
    },
    vueCompilerOptions: {
      ...baseVueTsconfig.vueCompilerOptions,
      ...vueTscOptions?.vueCompilerOptions,
    },
  }
  const rewriteWevuComponentType = shouldRewriteWevuComponentType(
    getVueCompilerLibOrUndefined(vueTsconfig.vueCompilerOptions?.lib),
  )

  await fs.ensureDir(tempOutDir)
  await fs.writeJson(tsconfigPath, vueTsconfig, { spaces: 2 })
  await runVueTsc(vueTscBin, tsconfigPath, configService.cwd)

  await Promise.all(vueEntries.map(async (entry) => {
    const relativeBase = resolveRelativeBase(entry.input, libRoot, configService.cwd)
    const candidate = path.join(tempOutDir, `${relativeBase.replace(FILE_EXTENSION_RE, '')}.d.ts`)
    const candidateWithExt = path.join(tempOutDir, `${relativeBase}.d.ts`)
    const sourcePath = await fs.pathExists(candidate)
      ? candidate
      : await fs.pathExists(candidateWithExt)
        ? candidateWithExt
        : undefined
    if (!sourcePath) {
      throw new Error(`[lib] 生成 Vue SFC dts 失败，未找到输出：${relativeBase}`)
    }
    const outputPath = path.resolve(configService.outDir, `${entry.outputBase}.d.ts`)
    await fs.ensureDir(path.dirname(outputPath))
    const content = await fs.readFile(sourcePath, 'utf8')
    const normalized = rewriteWevuComponentType
      ? rewriteVueComponentTypeToWevu(content)
      : content
    await fs.writeFile(outputPath, normalized)
  }))

  await fs.remove(tempRoot)
}

export async function generateVueDtsWithInternal(
  configService: ConfigService,
  vueEntries: ResolvedWeappLibEntry[],
  dtsOptions: NonNullable<ConfigService['weappLibConfig']>['dts'],
) {
  const languageCorePkg = resolveModule('@vue/language-core/package.json', { paths: [configService.cwd, process.cwd()] })
  const volarTsPkg = resolveModule('@volar/typescript/package.json', { paths: [configService.cwd, process.cwd()] })
  const tsPkg = resolveModule('typescript/package.json', { paths: [configService.cwd, process.cwd()] })
  if (!languageCorePkg || !volarTsPkg || !tsPkg) {
    throw new Error('[lib] internal 方案生成 Vue SFC dts 需要安装 typescript、@vue/language-core 与 @volar/typescript。')
  }

  const ts = await import('typescript') as typeof import('typescript')
  const { createParsedCommandLine, createVueLanguagePlugin, getDefaultCompilerOptions } = await import('@vue/language-core')
  const { proxyCreateProgram } = await import('@volar/typescript')

  const internalOptions = dtsOptions?.internal
  const tsconfigPath = await resolveInternalTsconfig(configService.cwd, internalOptions?.tsconfig)
  const configHost: import('typescript').ParseConfigFileHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    onUnRecoverableConfigFileDiagnostic: () => {},
  }
  const parsedVue = tsconfigPath
    ? createParsedCommandLine(ts, configHost, normalizePath(tsconfigPath))
    : undefined
  const parsedTs = tsconfigPath
    ? ts.getParsedCommandLineOfConfigFile(tsconfigPath, undefined, configHost)
    : undefined

  type CompilerOptionsWithNonTs = import('typescript').CompilerOptions & { allowNonTsExtensions?: boolean }
  const compilerOptions: CompilerOptionsWithNonTs = {
    ...(parsedVue?.options ?? parsedTs?.options ?? {}),
    ...(internalOptions?.compilerOptions ?? {}),
  }
  compilerOptions.noEmit = false
  compilerOptions.declaration = true
  compilerOptions.emitDeclarationOnly = true
  compilerOptions.allowNonTsExtensions = true
  compilerOptions.allowArbitraryExtensions = true
  compilerOptions.skipLibCheck = true
  compilerOptions.checkJs = false
  compilerOptions.target ??= ts.ScriptTarget.ESNext
  ensureModuleResolution(ts, compilerOptions)

  const baseVueOptions: VueCompilerOptions = parsedVue?.vueOptions ?? getDefaultCompilerOptions()
  const rawVueCompilerOptions = internalOptions?.vueCompilerOptions as Partial<VueCompilerOptions> | undefined
  const vueCompilerOptions: VueCompilerOptions = {
    ...baseVueOptions,
    lib: 'wevu',
    ...(rawVueCompilerOptions ?? {}),
  }
  const rewriteWevuComponentType = shouldRewriteWevuComponentType(vueCompilerOptions.lib)

  const rootNames = Array.from(new Set([
    ...((parsedTs?.fileNames ?? []).map((file: string) => (
      path.isAbsolute(file) ? file : path.resolve(configService.cwd, file)
    ))),
    ...vueEntries.map(entry => entry.input),
  ])).map(normalizePath)

  const host = ts.createCompilerHost(compilerOptions)
  const createProgram = proxyCreateProgram(ts, ts.createProgram, (tsInstance, options) => {
    const vueLanguagePlugin = createVueLanguagePlugin<string>(
      tsInstance,
      options.options,
      vueCompilerOptions,
      id => id,
    )
    return { languagePlugins: [vueLanguagePlugin] }
  })
  const program = createProgram({
    host,
    rootNames,
    options: compilerOptions,
    projectReferences: parsedTs?.projectReferences,
  })

  await Promise.all(vueEntries.map(async (entry) => {
    const sourceFile = resolveVueSourceFile(program, entry.input)
    if (!sourceFile) {
      throw new Error(`[lib] internal 方案生成 Vue SFC dts 失败，未找到源文件：${entry.input}`)
    }

    const outputs: Array<{ path: string, content: string }> = []
    const emitResult = program.emit(
      sourceFile,
      (filePath, content) => {
        outputs.push({ path: filePath, content })
      },
      undefined,
      true,
    )
    if (emitResult.emitSkipped && emitResult.diagnostics.length > 0) {
      const hostForDiagnostics = ts.createCompilerHost(compilerOptions)
      throw new Error(ts.formatDiagnosticsWithColorAndContext(emitResult.diagnostics, hostForDiagnostics))
    }

    const dtsOutput = outputs.find(output => isDtsOutputFile(output.path))
    if (!dtsOutput) {
      throw new Error(`[lib] internal 方案生成 Vue SFC dts 失败，未找到输出：${entry.input}`)
    }

    const mapOutput = outputs.find(output => isDtsMapOutputFile(output.path))
    const outputPath = path.resolve(configService.outDir, `${entry.outputBase}.d.ts`)
    await fs.ensureDir(path.dirname(outputPath))

    let content = dtsOutput.content
    if (rewriteWevuComponentType) {
      content = rewriteVueComponentTypeToWevu(content)
    }
    if (mapOutput) {
      const mapPath = path.resolve(configService.outDir, `${entry.outputBase}.d.ts.map`)
      await fs.writeFile(mapPath, mapOutput.content)
      content = replaceSourceMappingUrl(content, path.basename(mapPath))
    }
    await fs.writeFile(outputPath, content)
  }))
}
