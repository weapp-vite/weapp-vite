import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateLibDts } from './libDts'

const resolveWeappLibEntriesMock = vi.hoisted(() => vi.fn())
const buildMock = vi.hoisted(() => vi.fn(async () => {}))
const dtsMock = vi.hoisted(() => vi.fn(() => ({ name: 'mock-dts-plugin' })))
const resolveModuleMock = vi.hoisted(() => vi.fn())

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

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-lib-dts-'))
  tempDirs.push(dir)
  return dir
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
})
