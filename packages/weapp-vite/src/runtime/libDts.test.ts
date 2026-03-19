import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateLibDts } from './libDts'

const resolveWeappLibEntriesMock = vi.hoisted(() => vi.fn())
const buildMock = vi.hoisted(() => vi.fn(async () => {}))
const dtsMock = vi.hoisted(() => vi.fn(() => ({ name: 'mock-dts-plugin' })))
const resolveModuleMock = vi.hoisted(() => vi.fn())
const createParsedCommandLineMock = vi.hoisted(() => vi.fn())
const createVueLanguagePluginMock = vi.hoisted(() => vi.fn(() => ({})))
const getDefaultCompilerOptionsMock = vi.hoisted(() => vi.fn(() => ({ lib: 'wevu' })))
const proxyCreateProgramMock = vi.hoisted(() => vi.fn())

vi.mock('./lib', () => ({
  resolveWeappLibEntries: resolveWeappLibEntriesMock,
}))

vi.mock('rolldown', () => ({
  build: buildMock,
}))

vi.mock('rolldown-plugin-dts', () => ({
  dts: dtsMock,
}))

vi.mock('local-pkg', () => ({
  resolveModule: resolveModuleMock,
}))

vi.mock('@vue/language-core', () => ({
  createParsedCommandLine: createParsedCommandLineMock,
  createVueLanguagePlugin: createVueLanguagePluginMock,
  getDefaultCompilerOptions: getDefaultCompilerOptionsMock,
}))

vi.mock('@volar/typescript', () => ({
  proxyCreateProgram: proxyCreateProgramMock,
}))

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-lib-dts-'))
  tempDirs.push(dir)
  return dir
}

async function createFakeVueTscPackage(root: string, scriptContent: string) {
  const pkgPath = path.resolve(root, 'node_modules/vue-tsc/package.json')
  const binPath = path.resolve(root, 'node_modules/vue-tsc/bin/vue-tsc.js')
  await fs.ensureDir(path.dirname(pkgPath))
  await fs.ensureDir(path.dirname(binPath))
  await fs.writeJson(pkgPath, { name: 'vue-tsc', version: '0.0.0' }, { spaces: 2 })
  await fs.writeFile(binPath, scriptContent, 'utf8')
  return pkgPath
}

function createConfig(overrides: Record<string, unknown> = {}) {
  const cwd = (overrides.cwd as string) ?? '/project'
  const outDir = (overrides.outDir as string) ?? path.resolve(cwd, 'dist')
  const base = {
    cwd,
    outDir,
    absoluteSrcRoot: path.resolve(cwd, 'src'),
    weappLibConfig: {
      enabled: true,
      root: path.resolve(cwd, 'src'),
      dts: {
        enabled: true,
      },
    },
  } as any

  return {
    ...base,
    ...overrides,
    weappLibConfig: overrides.weappLibConfig === undefined
      ? base.weappLibConfig
      : overrides.weappLibConfig,
  } as any
}

describe('runtime lib dts generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}>;\nexport default _default;')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
    tempDirs.length = 0
  })

  it('returns early for disabled lib dts configs', async () => {
    const noLibConfig = createConfig()
    delete noLibConfig.weappLibConfig
    await generateLibDts(noLibConfig)
    await generateLibDts(createConfig({
      weappLibConfig: {
        enabled: false,
      },
    }))
    await generateLibDts(createConfig({
      weappLibConfig: {
        enabled: true,
        dts: {
          enabled: false,
        },
      },
    }))

    expect(resolveWeappLibEntriesMock).not.toHaveBeenCalled()
    expect(buildMock).not.toHaveBeenCalled()
  })

  it('returns when no lib entries are resolved', async () => {
    resolveWeappLibEntriesMock.mockResolvedValue([])

    await generateLibDts(createConfig())

    expect(resolveWeappLibEntriesMock).toHaveBeenCalledTimes(1)
    expect(buildMock).not.toHaveBeenCalled()
  })

  it('builds ts dts and normalizes deconflicted rolldown outputs', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const outputBase = 'components/button/index'
    const expectedPath = path.resolve(outDir, `${outputBase}.d.ts`)
    const candidatePath = path.resolve(outDir, `${outputBase}1.d.ts`)
    const jsStubPath = path.resolve(outDir, 'plain/index.d.ts')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/button/index.ts'),
        outputBase,
      },
      {
        input: path.resolve(root, 'src/plain/index.js'),
        outputBase: 'plain/index',
      },
    ])
    buildMock.mockImplementationOnce(async () => {
      await fs.ensureDir(path.dirname(expectedPath))
      await fs.writeFile(expectedPath, 'export {}')
      await fs.writeFile(candidatePath, 'export interface ButtonProps { value: string }')
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
        },
      },
    }))

    expect(buildMock).toHaveBeenCalledTimes(1)
    const buildArgs = buildMock.mock.calls[0]?.[0] as any
    expect(buildArgs.input).toEqual({
      [outputBase]: path.resolve(root, 'src/components/button/index.ts'),
    })
    expect(dtsMock).toHaveBeenCalledTimes(1)
    expect(dtsMock.mock.calls[0]?.[0]?.tsconfig).toBe(false)
    expect(dtsMock.mock.calls[0]?.[0]?.compilerOptions?.allowJs).toBe(true)

    expect(await fs.readFile(expectedPath, 'utf8')).toContain('interface ButtonProps')
    expect(await fs.pathExists(candidatePath)).toBe(false)
    expect(await fs.pathExists(jsStubPath)).toBe(true)
    expect(await fs.readFile(jsStubPath, 'utf8')).toBe('export {}\\n')
  })

  it('passes user rolldown dts options through to plugin', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const customTsconfig = path.resolve(root, 'tsconfig.lib.json')
    await fs.writeJson(customTsconfig, {}, { spaces: 2 })

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/card/index.ts'),
        outputBase: 'components/card/index',
      },
    ])

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          rolldown: {
            tsconfig: customTsconfig,
            compilerOptions: {
              preserveSymlinks: true,
            },
          },
        },
      },
    }))

    expect(dtsMock).toHaveBeenCalledTimes(1)
    const options = dtsMock.mock.calls[0]?.[0] as any
    expect(options.tsconfig).toBe(customTsconfig)
    expect(options.compilerOptions.allowImportingTsExtensions).toBe(true)
    expect(options.compilerOptions.allowJs).toBe(true)
    expect(options.compilerOptions.preserveSymlinks).toBe(true)
  })

  it('enables rolldown dts build mode when tsconfig uses project references', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const tsconfigPath = path.resolve(root, 'tsconfig.json')
    await fs.writeJson(tsconfigPath, {
      references: [
        { path: './tsconfig.app.json' },
      ],
      files: [],
    }, { spaces: 2 })

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/card/index.ts'),
        outputBase: 'components/card/index',
      },
    ])

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
        },
      },
    }))

    expect(dtsMock).toHaveBeenCalledTimes(1)
    const options = dtsMock.mock.calls[0]?.[0] as any
    expect(options.tsconfig).toBe(tsconfigPath)
    expect(options.build).toBe(true)
  })

  it('keeps non-stub expected dts when deconflicted file also exists', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const outputBase = 'components/input/index'
    const expectedPath = path.resolve(outDir, `${outputBase}.d.ts`)
    const candidatePath = path.resolve(outDir, `${outputBase}1.d.ts`)

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/input/index.ts'),
        outputBase,
      },
    ])
    buildMock.mockImplementationOnce(async () => {
      await fs.ensureDir(path.dirname(expectedPath))
      await fs.writeFile(expectedPath, 'export interface KeepExpected { value: string }')
      await fs.writeFile(candidatePath, 'export interface Candidate { value: number }')
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
        },
      },
    }))

    expect(await fs.readFile(expectedPath, 'utf8')).toContain('KeepExpected')
    expect(await fs.pathExists(candidatePath)).toBe(true)
  })

  it('generates vue dts via vue-tsc and rewrites DefineComponent to wevu constructor', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    const pkgPath = await createFakeVueTscPackage(root, `
const fs = require('fs')
const path = require('path')
const args = process.argv
const index = args.indexOf('--project')
const projectPath = index >= 0 ? args[index + 1] : ''
const config = JSON.parse(fs.readFileSync(projectPath, 'utf8'))
const outDir = config.compilerOptions.outDir
const rootDir = config.compilerOptions.rootDir || process.cwd()
for (const file of config.files || []) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/')
  const outFile = path.join(outDir, rel.replace(/\\.vue$/, '').replace(/\\.[mc]?[jt]sx?$/, '') + '.d.ts')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, 'declare const _default: import("vue").DefineComponent<{a:number}, {b:string}, {}, {}, {}>;\\nexport default _default;\\n')
}
`)

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (id === 'vue-tsc/package.json') {
        return pkgPath
      }
      return undefined
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'vue-tsc',
        },
      },
    }))

    expect(await fs.pathExists(outputPath)).toBe(true)
    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("wevu").WevuComponentConstructor')
    expect(content).not.toContain('import("vue").DefineComponent')
  })

  it('falls back to cwd as vue-tsc rootDir when vue entry is outside lib root', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'outside/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    const pkgPath = await createFakeVueTscPackage(root, `
const fs = require('fs')
const path = require('path')
const args = process.argv
const index = args.indexOf('--project')
const projectPath = index >= 0 ? args[index + 1] : ''
const config = JSON.parse(fs.readFileSync(projectPath, 'utf8'))
const outDir = config.compilerOptions.outDir
const rootDir = config.compilerOptions.rootDir || process.cwd()
for (const file of config.files || []) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/')
  const outFile = path.join(outDir, rel.replace(/\\.vue$/, '').replace(/\\.[mc]?[jt]sx?$/, '') + '.d.ts')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, 'declare const _default: import(\"vue\").DefineComponent<{}, {}, {}, {}, {}>;\\nexport default _default;\\n')
}
`)
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (id === 'vue-tsc/package.json') {
        return pkgPath
      }
      return undefined
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'vue-tsc',
        },
      },
    }))

    expect(await fs.pathExists(outputPath)).toBe(true)
    expect(await fs.readFile(outputPath, 'utf8')).toContain('import("wevu").WevuComponentConstructor')
  })

  it('throws when vue-tsc exits with non-zero code', async () => {
    const root = await createTempDir()
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    const pkgPath = await createFakeVueTscPackage(root, 'process.exit(2)')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (id === 'vue-tsc/package.json') {
        return pkgPath
      }
      return undefined
    })

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'vue-tsc',
        },
      },
    }))).rejects.toThrow('vue-tsc 生成 dts 失败，退出码 2')
  })

  it('throws when vue-tsc succeeds but expected declaration output is missing', async () => {
    const root = await createTempDir()
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    const pkgPath = await createFakeVueTscPackage(root, 'process.exit(0)')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (id === 'vue-tsc/package.json') {
        return pkgPath
      }
      return undefined
    })

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'vue-tsc',
        },
      },
    }))).rejects.toThrow('生成 Vue SFC dts 失败，未找到输出')
  })

  it('throws when vue-tsc mode is enabled but vue-tsc is missing', async () => {
    const root = await createTempDir()
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/button/index.vue'),
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockReturnValue(undefined)

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'vue-tsc',
        },
      },
    }))).rejects.toThrow('需要安装 vue-tsc')
  })

  it('throws when internal mode dependencies are missing', async () => {
    const root = await createTempDir()
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: path.resolve(root, 'src/components/button/index.vue'),
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockReturnValue(undefined)

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))).rejects.toThrow('internal 方案生成 Vue SFC dts 需要安装 typescript')
  })

  it('throws when internal mode cannot resolve vue source file in program', async () => {
    const root = await createTempDir()
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile() {
          return undefined
        },
        emit() {
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))).rejects.toThrow('未找到源文件')
  })

  it('formats diagnostics when internal mode emit is skipped', async () => {
    const root = await createTempDir()
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit() {
          return {
            emitSkipped: true,
            diagnostics: [{
              category: 1,
              code: 2322,
              messageText: 'emit failed',
            }],
          }
        },
      })
    })

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))).rejects.toThrow('emit failed')
  })

  it('generates vue dts and declaration map in internal mode', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    const mapPath = path.resolve(outDir, 'components/button/index.d.ts.map')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}>;\nexport default _default;\n//# sourceMappingURL=old-name.map')
          writeFile('/virtual/output.d.ts.map', '{"version":3}')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))

    expect(await fs.pathExists(outputPath)).toBe(true)
    expect(await fs.pathExists(mapPath)).toBe(true)
    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("wevu").WevuComponentConstructor')
    expect(content).toContain('sourceMappingURL=index.d.ts.map')
    expect(await fs.readFile(mapPath, 'utf8')).toContain('"version":3')
  })

  it('rewrites vue component type in post-pass when preferred lib is wevu', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })

    let libReadCount = 0
    const vueCompilerOptions: Record<string, unknown> = {}
    Object.defineProperty(vueCompilerOptions, 'lib', {
      configurable: true,
      enumerable: true,
      get() {
        libReadCount += 1
        return libReadCount === 1 ? 'vue' : 'wevu'
      },
    })

    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}>;\nexport default _default;')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
          internal: {
            vueCompilerOptions: vueCompilerOptions as any,
          },
        },
      },
    }))

    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("wevu").WevuComponentConstructor')
    expect(content).not.toContain('import("vue").DefineComponent')
  })

  it('invokes proxyCreateProgram setup callback when generating internal vue dts', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })

    const languagePlugin = { name: 'vue-language-plugin' }
    createVueLanguagePluginMock.mockImplementationOnce((
      _ts: unknown,
      _compilerOptions: unknown,
      _vueOptions: unknown,
      resolveVirtualFile: (id: string) => string,
    ) => {
      expect(resolveVirtualFile('virtual:file.vue')).toBe('virtual:file.vue')
      return languagePlugin
    })

    let setupResult: { languagePlugins: unknown[] } | undefined
    proxyCreateProgramMock.mockImplementation((tsInstance: any, _createProgram: any, setup: any) => {
      setupResult = setup(tsInstance, { options: {} })
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}>;\nexport default _default;')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))

    expect(setupResult?.languagePlugins).toEqual([languagePlugin])
    expect(await fs.pathExists(outputPath)).toBe(true)
  })

  it('pads missing DefineComponent generic args with any when rewriting', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{ a: number }, { b: string }>;\nexport default _default;')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))

    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("wevu").WevuComponentConstructor<{ a: number }, { b: string }, any, any, any>')
  })

  it('rewrites DefineComponent with nested generic and quoted literal content', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile(
            '/virtual/output.d.ts',
            'declare const _default: import("vue").DefineComponent<Record<string, Array<{ text: "a<b>" }>>, { message: "<node>" }, {}, {}, {}>;\nexport default _default;',
          )
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))

    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("wevu").WevuComponentConstructor<Record<string, Array<{ text: "a<b>" }>>, { message: "<node>" }, {}, {}, {}>')
  })

  it('keeps original content when DefineComponent generic is malformed', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{ a: number };\nexport default _default;')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await generateLibDts(createConfig({
      cwd: root,
      outDir,
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))

    const content = await fs.readFile(outputPath, 'utf8')
    expect(content).toContain('import("vue").DefineComponent<{ a: number };')
  })

  it('skips post-pass rewrite when vue output disappears after stub phase', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const outputPath = path.resolve(outDir, 'components/button/index.d.ts')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')

    const pkgPath = await createFakeVueTscPackage(root, `
const fs = require('fs')
const path = require('path')
const args = process.argv
const index = args.indexOf('--project')
const projectPath = index >= 0 ? args[index + 1] : ''
const config = JSON.parse(fs.readFileSync(projectPath, 'utf8'))
const outDir = config.compilerOptions.outDir
const rootDir = config.compilerOptions.rootDir || process.cwd()
for (const file of config.files || []) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/')
  const outFile = path.join(outDir, rel.replace(/\\.vue$/, '').replace(/\\.[mc]?[jt]sx?$/, '') + '.d.ts')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, 'declare const _default: import(\"vue\").DefineComponent<{}, {}, {}, {}, {}>;\\nexport default _default;\\n')
}
`)
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (id === 'vue-tsc/package.json') {
        return pkgPath
      }
      return undefined
    })

    const originalPathExists = fs.pathExists.bind(fs)
    let outputPathHit = 0
    let skippedRewriteCheck = false
    const pathExistsSpy = vi.spyOn(fs, 'pathExists').mockImplementation(async (targetPath: string) => {
      if (targetPath === outputPath) {
        outputPathHit += 1
        if (outputPathHit >= 2) {
          skippedRewriteCheck = true
          return false
        }
      }
      return originalPathExists(targetPath)
    })

    try {
      await generateLibDts(createConfig({
        cwd: root,
        outDir,
        weappLibConfig: {
          enabled: true,
          root: path.resolve(root, 'src'),
          dts: {
            enabled: true,
            mode: 'vue-tsc',
          },
        },
      }))
    }
    finally {
      pathExistsSpy.mockRestore()
    }

    expect(skippedRewriteCheck).toBe(true)
  })

  it('normalizes relative parsed tsconfig file names to absolute rootNames', async () => {
    const root = await createTempDir()
    const outDir = path.resolve(root, 'dist')
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    const tsconfigPath = path.resolve(root, 'tsconfig.internal.json')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    await fs.writeJson(tsconfigPath, {}, { spaces: 2 })
    await fs.writeFile(path.resolve(root, 'relative-entry.ts'), 'export const value = 1\n', 'utf8')

    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })

    const expectedRelativeEntry = path.resolve(root, 'relative-entry.ts').split(path.sep).join('/')
    let capturedRootNames: string[] = []
    const originalIsAbsolute = path.isAbsolute.bind(path)
    const isAbsoluteSpy = vi.spyOn(path, 'isAbsolute').mockImplementation((value: string) => {
      if (value.includes('relative-entry.ts')) {
        return false
      }
      return originalIsAbsolute(value)
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return (options: { rootNames: string[] }) => {
        capturedRootNames = options.rootNames
        return {
          getSourceFile(filePath: string) {
            return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
          },
          emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
            writeFile('/virtual/output.d.ts', 'declare const _default: import("vue").DefineComponent<{}, {}, {}, {}, {}>;\nexport default _default;')
            return {
              emitSkipped: false,
              diagnostics: [],
            }
          },
        }
      }
    })

    try {
      await generateLibDts(createConfig({
        cwd: root,
        outDir,
        weappLibConfig: {
          enabled: true,
          root: path.resolve(root, 'src'),
          dts: {
            enabled: true,
            mode: 'internal',
            internal: {
              tsconfig: 'tsconfig.internal.json',
            },
          },
        },
      }))
    }
    finally {
      isAbsoluteSpy.mockRestore()
    }

    expect(capturedRootNames).toContain(expectedRelativeEntry)
  })

  it('throws when internal mode emit result has no dts output file', async () => {
    const root = await createTempDir()
    const vueInput = path.resolve(root, 'src/components/button/index.vue')
    await fs.ensureDir(path.dirname(vueInput))
    await fs.writeFile(vueInput, '<template><view /></template>', 'utf8')
    resolveWeappLibEntriesMock.mockResolvedValue([
      {
        input: vueInput,
        outputBase: 'components/button/index',
      },
    ])
    resolveModuleMock.mockImplementation((id: string) => {
      if (
        id === '@vue/language-core/package.json'
        || id === '@volar/typescript/package.json'
        || id === 'typescript/package.json'
      ) {
        return '/virtual/package.json'
      }
      return undefined
    })
    proxyCreateProgramMock.mockImplementation(() => {
      return () => ({
        getSourceFile(filePath: string) {
          return filePath.endsWith('.vue') ? { fileName: filePath } : undefined
        },
        emit(_sourceFile: unknown, writeFile: (filePath: string, content: string) => void) {
          writeFile('/virtual/output.js', 'module.exports = {}')
          return {
            emitSkipped: false,
            diagnostics: [],
          }
        },
      })
    })

    await expect(generateLibDts(createConfig({
      cwd: root,
      outDir: path.resolve(root, 'dist'),
      weappLibConfig: {
        enabled: true,
        root: path.resolve(root, 'src'),
        dts: {
          enabled: true,
          mode: 'internal',
        },
      },
    }))).rejects.toThrow('未找到输出')
  })
})
