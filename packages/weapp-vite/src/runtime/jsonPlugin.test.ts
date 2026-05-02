import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createJsonServicePlugin } from './jsonPlugin'
import { createRuntimeState } from './runtimeState'

function createTestContext(cwd: string, pages: string[] = ['pages/index/index']) {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
    configService: {
      options: {
        cwd,
      },
      defineImportMetaEnv: {},
      importMetaDefineEntries: {},
      aliasEntries: [],
      platform: 'weapp',
      packageJson: {
        dependencies: {},
      },
      weappViteConfig: {},
    },
    autoRoutesService: {
      ensureFresh: async () => {},
      getSignature: () => JSON.stringify({ pages }),
      getReference: () => ({
        pages,
        entries: [...pages],
        subPackages: [],
      }),
    },
  } as any

  createJsonServicePlugin(ctx)
  return ctx
}

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => fs.remove(root)))
})

describe('runtime/jsonPlugin', () => {
  it('reads app.json.ts script config as plain object', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-plugin-'))
    tempRoots.push(root)
    const srcRoot = path.join(root, 'src')
    await fs.ensureDir(srcRoot)
    const entry = path.join(srcRoot, 'app.json.ts')
    await fs.writeFile(entry, `export default { pages: ['pages/index/index'] }\n`, 'utf8')

    const ctx = createTestContext(root)
    const result = await ctx.jsonService.read(entry)

    expect(result).toEqual({
      pages: ['pages/index/index'],
      subPackages: [],
    })
  })

  it('inlines weapp-vite/auto-routes imports before executing app.json.ts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-json-plugin-'))
    tempRoots.push(root)
    const srcRoot = path.join(root, 'src')
    await fs.ensureDir(srcRoot)
    const entry = path.join(srcRoot, 'app.json.ts')
    await fs.writeFile(entry, [
      `import routes, { pages } from 'weapp-vite/auto-routes'`,
      '',
      'export default {',
      '  pages,',
      '  subPackages: routes.subPackages,',
      '}',
      '',
    ].join('\n'), 'utf8')

    const ctx = createTestContext(root, ['pages/home/index'])
    const result = await ctx.jsonService.read(entry)

    expect(result).toEqual({
      pages: ['pages/home/index'],
      subPackages: [],
    })
  })
})
