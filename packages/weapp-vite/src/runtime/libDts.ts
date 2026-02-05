import type { VueCompilerOptions } from '@vue/language-core'
import type { Options as RolldownDtsOptions } from 'rolldown-plugin-dts'
import type { ConfigService } from './config/types'
import type { ResolvedWeappLibEntry } from './lib'
import { spawn } from 'node:child_process'
import os from 'node:os'
import process from 'node:process'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import { resolveModule } from 'local-pkg'
import path from 'pathe'
import { build } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import { resolveWeappLibEntries } from './lib'

const DTS_INPUT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])

function isBundledDtsEntry(entryPath: string) {
  const ext = path.extname(entryPath)
  if (entryPath.endsWith('.d.ts')) {
    return true
  }
  return DTS_INPUT_EXTENSIONS.has(ext)
}

function getStubContent(entryPath: string) {
  if (entryPath.endsWith('.vue')) {
    return 'declare const _default: any\\nexport default _default\\n'
  }
  return 'export {}\\n'
}

async function ensureStub(entry: ResolvedWeappLibEntry, outDir: string) {
  const outputPath = path.resolve(outDir, `${entry.outputBase}.d.ts`)
  if (await fs.pathExists(outputPath)) {
    return
  }
  await fs.ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, getStubContent(entry.input))
}

async function findDeconflictedDtsPath(expectedPath: string) {
  const dir = path.dirname(expectedPath)
  if (!await fs.pathExists(dir)) {
    return undefined
  }
  const baseName = path.basename(expectedPath, '.d.ts')
  const entries = await fs.readdir(dir)
  let bestMatch: string | undefined
  let bestIndex = Number.POSITIVE_INFINITY
  for (const name of entries) {
    if (!name.startsWith(baseName) || !name.endsWith('.d.ts')) {
      continue
    }
    if (name === `${baseName}.d.ts`) {
      continue
    }
    const suffix = name.slice(baseName.length, -'.d.ts'.length)
    if (!/^\d+$/.test(suffix)) {
      continue
    }
    const index = Number.parseInt(suffix, 10)
    if (Number.isNaN(index) || index >= bestIndex) {
      continue
    }
    bestIndex = index
    bestMatch = path.join(dir, name)
  }
  return bestMatch
}

async function isStubDts(filePath: string) {
  const content = await fs.readFile(filePath, 'utf8')
  return /^export\s*\{\s*\};?\s*$/.test(content.trim())
}

async function normalizeRolldownDtsOutput(entries: ResolvedWeappLibEntry[], outDir: string) {
  await Promise.all(entries.map(async (entry) => {
    const expectedPath = path.resolve(outDir, `${entry.outputBase}.d.ts`)
    const candidate = await findDeconflictedDtsPath(expectedPath)
    if (!candidate) {
      return
    }
    const shouldReplace = !(await fs.pathExists(expectedPath)) || await isStubDts(expectedPath)
    if (!shouldReplace) {
      return
    }
    await fs.ensureDir(path.dirname(expectedPath))
    await fs.copy(candidate, expectedPath)
    if (candidate !== expectedPath) {
      await fs.remove(candidate)
    }
  }))
}

function normalizePath(value: string) {
  return value.split(path.sep).join('/')
}

function resolveRelativeBase(entryPath: string, libRoot: string, cwd: string) {
  const relativeToRoot = path.relative(libRoot, entryPath)
  if (!relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot)) {
    return normalizePath(relativeToRoot)
  }
  const relativeToCwd = path.relative(cwd, entryPath)
  return normalizePath(relativeToCwd)
}

function runVueTsc(binPath: string, projectPath: string, cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, '--project', projectPath], {
      cwd,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`[lib] vue-tsc 生成 dts 失败，退出码 ${code ?? 'null'}`))
    })
  })
}

async function resolveInternalTsconfig(cwd: string, tsconfig: string | false | undefined) {
  if (tsconfig === false) {
    return undefined
  }
  if (tsconfig) {
    const resolved = path.isAbsolute(tsconfig) ? tsconfig : path.resolve(cwd, tsconfig)
    if (!await fs.pathExists(resolved)) {
      throw new Error(`[lib] internal 方案未找到 tsconfig：${resolved}`)
    }
    return resolved
  }
  const defaultPath = path.resolve(cwd, 'tsconfig.json')
  return await fs.pathExists(defaultPath) ? defaultPath : undefined
}

function ensureModuleResolution(ts: typeof import('typescript'), compilerOptions: import('typescript').CompilerOptions) {
  if (compilerOptions.moduleResolution) {
    return
  }
  const moduleKind = typeof compilerOptions.module === 'number'
    ? compilerOptions.module
    : (compilerOptions.target ?? ts.ScriptTarget.ES5) >= ts.ScriptTarget.ES2015
        ? ts.ModuleKind.ES2015
        : ts.ModuleKind.CommonJS

  let moduleResolution: import('typescript').ModuleResolutionKind
  switch (moduleKind) {
    case ts.ModuleKind.CommonJS:
      moduleResolution = ts.ModuleResolutionKind.Node10
      break
    case ts.ModuleKind.Node16:
      moduleResolution = ts.ModuleResolutionKind.Node16
      break
    case ts.ModuleKind.NodeNext:
      moduleResolution = ts.ModuleResolutionKind.NodeNext
      break
    default:
      moduleResolution = ts.version.startsWith('5')
        ? ts.ModuleResolutionKind.Bundler
        : ts.ModuleResolutionKind.Classic
      break
  }
  compilerOptions.moduleResolution = moduleResolution
}

function isDtsOutputFile(filePath: string) {
  return /\.d\.(?:m|c)?ts$/.test(filePath) && !filePath.endsWith('.map')
}

function isDtsMapOutputFile(filePath: string) {
  return /\.d\.(?:m|c)?ts\.map$/.test(filePath)
}

function replaceSourceMappingUrl(content: string, mapFileName: string) {
  const normalized = content.replace(/# sourceMappingURL=.*$/gm, `# sourceMappingURL=${mapFileName}`)
  return normalized
}

function resolveVueSourceFile(program: import('typescript').Program, filePath: string) {
  const normalized = normalizePath(filePath)
  const candidates = [
    filePath,
    normalized,
    `${filePath}.ts`,
    `${filePath}.js`,
    `${filePath}.tsx`,
    `${filePath}.jsx`,
    `${normalized}.ts`,
    `${normalized}.js`,
    `${normalized}.tsx`,
    `${normalized}.jsx`,
  ]
  for (const candidate of candidates) {
    const sourceFile = program.getSourceFile(candidate)
    if (sourceFile) {
      return sourceFile
    }
  }
  return undefined
}

function getVueCompilerLib(value: unknown) {
  if (Array.isArray(value)) {
    const resolved = value.filter(item => typeof item === 'string')
    return resolved.length > 0 ? resolved : undefined
  }
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

function shouldRewriteWevuComponentType(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.includes('wevu')
  }
  if (typeof value === 'string') {
    return value === 'wevu'
  }
  return true
}

function splitTopLevelTypeArgs(value: string) {
  const args: string[] = []
  let depth = 0
  let start = 0
  let quote: '"' | '\'' | '`' | null = null
  let escape = false
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\\\') {
        escape = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      continue
    }
    if (char === '<') {
      depth += 1
      continue
    }
    if (char === '>') {
      if (depth > 0) {
        depth -= 1
      }
      continue
    }
    if (char === ',' && depth === 0) {
      args.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = value.slice(start).trim()
  if (tail) {
    args.push(tail)
  }
  return args
}

function findMatchingAngleBracket(value: string, start: number) {
  let depth = 1
  let quote: '"' | '\'' | '`' | null = null
  let escape = false
  for (let i = start; i < value.length; i += 1) {
    const char = value[i]
    if (quote) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\\\') {
        escape = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      continue
    }
    if (char === '<') {
      depth += 1
      continue
    }
    if (char === '>') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function rewriteVueComponentTypeToWevu(content: string) {
  const token = 'import("vue").DefineComponent<'
  const tokenSingle = 'import(\'vue\').DefineComponent<'
  if (!content.includes(token) && !content.includes(tokenSingle)) {
    return content
  }
  let result = ''
  let index = 0
  while (index < content.length) {
    const nextDouble = content.indexOf(token, index)
    const nextSingle = content.indexOf(tokenSingle, index)
    const next = nextDouble === -1
      ? nextSingle
      : nextSingle === -1
        ? nextDouble
        : Math.min(nextDouble, nextSingle)
    if (next === -1) {
      result += content.slice(index)
      break
    }
    const match = next === nextDouble ? token : tokenSingle
    result += content.slice(index, next)
    const start = next + match.length
    const end = findMatchingAngleBracket(content, start)
    if (end === -1) {
      result += content.slice(next)
      break
    }
    const args = splitTopLevelTypeArgs(content.slice(start, end))
    while (args.length < 5) {
      args.push('any')
    }
    const replaced = `import(\"wevu\").WevuComponentConstructor<${args.slice(0, 5).join(', ')}>`
    result += replaced
    index = end + 1
  }
  return result
}

async function generateVueDtsWithVueTsc(
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
    getVueCompilerLib(vueTsconfig.vueCompilerOptions?.lib),
  )

  await fs.ensureDir(tempOutDir)
  await fs.writeJson(tsconfigPath, vueTsconfig, { spaces: 2 })
  await runVueTsc(vueTscBin, tsconfigPath, configService.cwd)

  await Promise.all(vueEntries.map(async (entry) => {
    const relativeBase = resolveRelativeBase(entry.input, libRoot, configService.cwd)
    const candidate = path.join(tempOutDir, `${removeExtensionDeep(relativeBase)}.d.ts`)
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

async function generateVueDtsWithInternal(
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

export async function generateLibDts(configService: ConfigService) {
  const libConfig = configService.weappLibConfig
  if (!libConfig) {
    return
  }
  if (!libConfig.enabled) {
    return
  }
  const dtsOptions = libConfig.dts
  if (dtsOptions?.enabled === false) {
    return
  }

  const entries = await resolveWeappLibEntries(configService, libConfig)
  if (entries.length === 0) {
    return
  }

  const vueEntries = entries.filter(entry => entry.input.endsWith('.vue'))
  const tsEntries = entries.filter(entry => !entry.input.endsWith('.vue') && isBundledDtsEntry(entry.input))

  const input: Record<string, string> = {}

  for (const entry of tsEntries) {
    input[entry.outputBase] = entry.input
  }

  const inputNames = Object.keys(input)
  if (inputNames.length > 0) {
    const tsconfigPath = path.resolve(configService.cwd, 'tsconfig.json')
    const hasTsconfig = await fs.pathExists(tsconfigPath)
    const userRolldownOptions: RolldownDtsOptions = dtsOptions?.rolldown ?? {}
    const hasUserTsconfig = Object.prototype.hasOwnProperty.call(userRolldownOptions, 'tsconfig')
    const resolvedTsconfig = hasUserTsconfig
      ? userRolldownOptions.tsconfig
      : hasTsconfig
        ? tsconfigPath
        : false
    const compilerOptions: NonNullable<RolldownDtsOptions['compilerOptions']> = {
      allowImportingTsExtensions: true,
      allowJs: true,
      ...userRolldownOptions.compilerOptions,
    }
    await build({
      input,
      plugins: dts({
        ...userRolldownOptions,
        tsconfig: resolvedTsconfig,
        compilerOptions,
        cwd: configService.cwd,
        emitDtsOnly: true,
        vue: false,
      }),
      output: {
        dir: configService.outDir,
        entryFileNames: '[name].d.ts',
      },
      write: true,
    })
    await normalizeRolldownDtsOutput(tsEntries, configService.outDir)
  }

  if (vueEntries.length > 0) {
    if (dtsOptions?.mode === 'vue-tsc') {
      await generateVueDtsWithVueTsc(configService, libConfig, vueEntries, dtsOptions)
    }
    else {
      await generateVueDtsWithInternal(configService, vueEntries, dtsOptions)
    }
  }

  await Promise.all(entries.map(entry => ensureStub(entry, configService.outDir)))

  if (vueEntries.length > 0) {
    const preferLib = dtsOptions?.mode === 'vue-tsc'
      ? getVueCompilerLib(dtsOptions?.vueTsc?.vueCompilerOptions?.lib)
      : getVueCompilerLib(dtsOptions?.internal?.vueCompilerOptions?.lib)
    if (shouldRewriteWevuComponentType(preferLib)) {
      await Promise.all(vueEntries.map(async (entry) => {
        const outputPath = path.resolve(configService.outDir, `${entry.outputBase}.d.ts`)
        if (!await fs.pathExists(outputPath)) {
          return
        }
        const content = await fs.readFile(outputPath, 'utf8')
        const normalized = rewriteVueComponentTypeToWevu(content)
        if (normalized !== content) {
          await fs.writeFile(outputPath, normalized)
        }
      }))
    }
  }
}
