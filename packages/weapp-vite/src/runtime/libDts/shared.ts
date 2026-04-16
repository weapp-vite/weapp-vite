import type { ResolvedWeappLibEntry } from '../lib'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

const DTS_INPUT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const NUMERIC_SUFFIX_RE = /^\d+$/
const EMPTY_EXPORT_RE = /^export\s*\{\s*\};?\s*$/
const DTS_OUTPUT_FILE_RE = /\.d\.(?:m|c)?ts$/
const DTS_MAP_OUTPUT_FILE_RE = /\.d\.(?:m|c)?ts\.map$/
const SOURCE_MAPPING_URL_RE = /# sourceMappingURL=.*$/gm

export function isBundledDtsEntry(entryPath: string) {
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

export async function ensureStub(entry: ResolvedWeappLibEntry, outDir: string) {
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
    if (!NUMERIC_SUFFIX_RE.test(suffix)) {
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
  return EMPTY_EXPORT_RE.test(content.trim())
}

export async function normalizeRolldownDtsOutput(entries: ResolvedWeappLibEntry[], outDir: string) {
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

export function normalizePath(value: string) {
  return value.split(path.sep).join('/')
}

export function resolveRelativeBase(entryPath: string, libRoot: string, cwd: string) {
  const relativeToRoot = path.relative(libRoot, entryPath)
  if (!relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot)) {
    return normalizePath(relativeToRoot)
  }
  const relativeToCwd = path.relative(cwd, entryPath)
  return normalizePath(relativeToCwd)
}

export function runVueTsc(binPath: string, projectPath: string, cwd: string) {
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

export async function resolveInternalTsconfig(cwd: string, tsconfig: string | false | undefined) {
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

export async function tsconfigHasProjectReferences(tsconfigPath: string | false | undefined) {
  if (!tsconfigPath) {
    return false
  }
  try {
    const config = await fs.readJson(tsconfigPath) as { references?: unknown }
    return Array.isArray(config?.references) && config.references.length > 0
  }
  catch {
    return false
  }
}

export function ensureModuleResolution(ts: typeof import('typescript'), compilerOptions: import('typescript').CompilerOptions) {
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

export function isDtsOutputFile(filePath: string) {
  return DTS_OUTPUT_FILE_RE.test(filePath) && !filePath.endsWith('.map')
}

export function isDtsMapOutputFile(filePath: string) {
  return DTS_MAP_OUTPUT_FILE_RE.test(filePath)
}

export function replaceSourceMappingUrl(content: string, mapFileName: string) {
  return content.replace(SOURCE_MAPPING_URL_RE, `# sourceMappingURL=${mapFileName}`)
}

export function resolveVueSourceFile(program: import('typescript').Program, filePath: string) {
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

export function resolveDtsOutputRelativePath(entryPath: string, libRoot: string, cwd: string) {
  return `${removeExtensionDeep(resolveRelativeBase(entryPath, libRoot, cwd))}.d.ts`
}
