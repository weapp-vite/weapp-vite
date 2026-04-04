import os from 'node:os'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  createLibEntryFileNameResolver,
  hasLibEntry,
  isLibMode,
  resolveWeappLibConfig,
  resolveWeappLibEntries,
} from './lib'

function createConfigService(absoluteSrcRoot: string, enabled = true) {
  return {
    absoluteSrcRoot,
    weappLibConfig: enabled ? { enabled: true } : { enabled: false },
    relativeAbsoluteSrcRoot(filePath: string) {
      const relative = path.relative(absoluteSrcRoot, filePath)
      if (!relative || relative.startsWith('..')) {
        return ''
      }
      return relative
    },
  } as any
}

function createResolvedLibConfig(overrides: Record<string, any>) {
  return {
    enabled: true,
    entry: 'index.ts',
    root: '',
    preservePath: true,
    componentJson: 'auto',
    dts: {
      enabled: true,
      mode: 'internal',
    },
    ...overrides,
  } as any
}

describe('runtime/lib', () => {
  it('resolves hasLibEntry and lib mode switches', () => {
    expect(hasLibEntry(undefined)).toBe(false)
    expect(hasLibEntry('')).toBe(false)
    expect(hasLibEntry('components/button/index.ts')).toBe(true)
    expect(hasLibEntry([])).toBe(false)
    expect(hasLibEntry(['a.ts'])).toBe(true)
    expect(hasLibEntry({})).toBe(false)
    expect(hasLibEntry({ button: 'a.ts' })).toBe(true)

    expect(isLibMode(createConfigService('/tmp/project/src', true))).toBe(true)
    expect(isLibMode(createConfigService('/tmp/project/src', false))).toBe(false)
    expect(isLibMode(undefined)).toBe(false)
  })

  it('normalizes resolveWeappLibConfig defaults and dts modes', () => {
    const noConfig = resolveWeappLibConfig({
      cwd: '/project',
      srcRoot: 'src',
      config: undefined,
    })
    expect(noConfig).toBeUndefined()

    const resolved = resolveWeappLibConfig({
      cwd: '/project',
      srcRoot: 'src',
      config: {
        entry: 'components/button/index.ts',
        root: 'lib-src',
        preservePath: false,
        dts: {
          enabled: false,
          mode: 'vue-tsc',
        },
      },
    })!

    expect(resolved.enabled).toBe(true)
    expect(resolved.root).toBe('/project/lib-src')
    expect(resolved.preservePath).toBe(false)
    expect(resolved.componentJson).toBe('auto')
    expect(resolved.dts).toMatchObject({
      enabled: false,
      mode: 'vue-tsc',
    })

    const boolDts = resolveWeappLibConfig({
      cwd: '/project',
      srcRoot: 'src',
      config: {
        entry: 'components/button/index.ts',
        dts: false,
      },
    })!
    expect(boolDts.dts.enabled).toBe(false)
    expect(boolDts.dts.mode).toBe('internal')
  })

  it('creates lib entry fileName resolver and validates return values', async () => {
    expect(createLibEntryFileNameResolver(createResolvedLibConfig({ fileName: undefined }))).toBeUndefined()

    const resolverByTemplate = createLibEntryFileNameResolver(createResolvedLibConfig({ fileName: 'dist/[name]' }))!
    expect(resolverByTemplate({ name: 'components/button' })).toBe('dist/components/button.js')

    const resolverByFn = createLibEntryFileNameResolver(createResolvedLibConfig({
      fileName: ({ name }: { name: string }) => `esm/${name}`,
    }))!
    expect(resolverByFn({ name: 'entry', facadeModuleId: '/project/src/entry.ts' })).toBe('esm/entry.js')

    const invalidFn = createLibEntryFileNameResolver(createResolvedLibConfig({
      fileName: () => 1 as any,
    }))!
    expect(() => invalidFn({ name: 'entry' })).toThrow('`weapp.lib.fileName` 必须返回字符串。')
  })

  it('resolves entry files from js, vue and extensionless files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-'))
    const srcRoot = path.join(root, 'src')
    await fs.ensureDir(path.join(srcRoot, 'components'))
    await fs.writeFile(path.join(srcRoot, 'components/button.js'), 'export default 1', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'components/card.vue'), '<template><view/></template>', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'raw-entry'), 'export const raw = true', 'utf8')

    try {
      const configService = createConfigService(srcRoot)

      const jsEntries = await resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: 'components/button',
          root: srcRoot,
        }),
      )
      expect(jsEntries).toEqual([
        {
          name: 'components/button',
          input: path.join(srcRoot, 'components/button.js'),
          relativeBase: 'components/button',
          outputBase: 'components/button',
        },
      ])

      const vueEntries = await resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: 'components/card',
          root: srcRoot,
          preservePath: false,
        }),
      )
      expect(vueEntries[0]?.name).toBe('card')
      expect(vueEntries[0]?.outputBase).toBe('card')

      const rawEntries = await resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: 'raw-entry',
          root: srcRoot,
        }),
      )
      expect(rawEntries[0]?.input).toBe(path.join(srcRoot, 'raw-entry'))
      expect(rawEntries[0]?.outputBase).toBe('raw-entry')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('throws clear errors for invalid lib entry and naming conflicts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-lib-'))
    const srcRoot = path.join(root, 'src')
    const outsideFile = path.join(root, 'outside.ts')
    await fs.ensureDir(srcRoot)
    await fs.writeFile(path.join(srcRoot, 'a.ts'), 'export default 1', 'utf8')
    await fs.writeFile(path.join(srcRoot, 'b.ts'), 'export default 2', 'utf8')
    await fs.writeFile(outsideFile, 'export default 3', 'utf8')

    try {
      const configService = createConfigService(srcRoot)

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: [],
          root: srcRoot,
        }),
      )).rejects.toThrow('`weapp.lib.entry` 不能为空')

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: ['a.ts', 'b.ts'],
          root: srcRoot,
          fileName: 'bundle.js',
        }),
      )).rejects.toThrow('多入口模式下必须包含 `[name]`')

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: 'missing.ts',
          root: srcRoot,
        }),
      )).rejects.toThrow('未找到 lib 入口文件：missing.ts')

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: outsideFile,
          root,
        }),
      )).rejects.toThrow('lib 入口解析失败')

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: {
            a: 'a.ts',
            b: 'b.ts',
          },
          root: srcRoot,
          fileName: () => 'same.js',
        }),
      )).rejects.toThrow('lib 输出路径冲突：same')

      await expect(resolveWeappLibEntries(
        configService,
        createResolvedLibConfig({
          entry: 'a.ts',
          root: srcRoot,
          fileName: '/',
        }),
      )).rejects.toThrow('`weapp.lib.fileName` 解析结果为空')
    }
    finally {
      await fs.remove(root)
    }
  })
})
