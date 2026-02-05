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

export async function generateLibDts(configService: ConfigService) {
  const libConfig = configService.weappLibConfig
  const dtsOptions = libConfig?.dts
  if (!libConfig?.enabled || dtsOptions?.enabled === false) {
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
    const userRolldownOptions = dtsOptions?.rolldown ?? {}
    const hasUserTsconfig = Object.prototype.hasOwnProperty.call(userRolldownOptions, 'tsconfig')
    const resolvedTsconfig = hasUserTsconfig
      ? userRolldownOptions.tsconfig
      : hasTsconfig
        ? tsconfigPath
        : false
    const compilerOptions = {
      allowImportingTsExtensions: true,
      allowJs: true,
      jsx: 'preserve',
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

    const baseVueTsconfig = {
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        declarationMap: false,
        outDir: tempOutDir,
        declarationDir: tempOutDir,
        rootDir: libRoot,
        allowJs: true,
        jsx: 'preserve',
        skipLibCheck: true,
        module: 'ESNext',
        target: 'ESNext',
        moduleResolution: 'Bundler',
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
      await fs.copy(sourcePath, outputPath)
    }))

    await fs.remove(tempRoot)
  }

  await Promise.all(entries.map(entry => ensureStub(entry, configService.outDir)))
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

function resolveRelativeBase(entryPath: string, libRoot: string, cwd: string) {
  const relativeToRoot = path.relative(libRoot, entryPath)
  if (!relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot)) {
    return normalizePath(relativeToRoot)
  }
  const relativeToCwd = path.relative(cwd, entryPath)
  return normalizePath(relativeToCwd)
}

function normalizePath(value: string) {
  return value.split(path.sep).join('/')
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
