/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI 分析。 */
import { mkdtemp } from 'node:fs/promises'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(REPO_ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const TEMP_ROOT = path.join(REPO_ROOT, '.tmp')

async function writeText(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath)
  await fs.ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
}

async function createPage(root: string, route: string, script = 'Page({})\n') {
  await writeText(root, `src/${route}.ts`, script)
  await writeText(root, `src/${route}.wxml`, `<view>${route}</view>\n`)
}

async function createPreloadProject() {
  await fs.ensureDir(TEMP_ROOT)
  const root = await mkdtemp(path.join(TEMP_ROOT, 'preload-analyze-'))
  await writeText(root, 'package.json', JSON.stringify({ private: true, type: 'module' }, null, 2))
  await writeText(root, 'project.config.json', JSON.stringify({
    appid: 'wxb3d842a4a7e3440d',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
  }, null, 2))
  await writeText(root, 'weapp-vite.config.ts', [
    'import { defineConfig } from \'weapp-vite\'',
    '',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    npm: { enable: false },',
    '  },',
    '  build: { minify: false },',
    '})',
    '',
  ].join('\n'))
  await writeText(root, 'src/app.ts', 'App({})\n')
  await writeText(root, 'src/app.json', JSON.stringify({
    pages: ['pages/index/index'],
    subPackages: [
      { root: 'packages/order', name: 'orders', pages: ['index'] },
      { root: 'packages/profile', pages: ['index'] },
      { root: 'packages/independent', independent: true, pages: ['index'] },
    ],
    preloadRule: {
      '/pages/index': { packages: ['orders'] },
      '/packages/independent/index': { packages: ['__APP__', 'packages/missing'] },
    },
  }, null, 2))

  await createPage(root, 'pages/index/index', [
    'const router = useRouter()',
    'router.push(\'/packages/profile/index\')',
    'const values: string[] = []',
    'values.push(\'/packages/order/index\')',
    'const dynamicTarget = \'/packages/order/index\'',
    'router.push(dynamicTarget)',
    'Page({ data: { ready: true } })',
    '',
  ].join('\n'))
  await writeText(root, 'src/pages/index/index.wxml', [
    '<navigator url="/packages/order/index">order</navigator>',
    '<navigator url="{{dynamicTarget}}">dynamic</navigator>',
    '',
  ].join('\n'))
  await createPage(root, 'packages/order/index', [
    'import { payload } from \'./payload\'',
    'Page({ data: { payload } })',
    '',
  ].join('\n'))
  await createPage(root, 'packages/profile/index', [
    'import { payload } from \'./payload\'',
    'Page({ data: { payload } })',
    '',
  ].join('\n'))
  await createPage(root, 'packages/independent/index', [
    'wx.reLaunch({ url: \'/pages/index/index\' })',
    'Page({})',
    '',
  ].join('\n'))
  await writeText(root, 'src/packages/order/payload.ts', `export const payload = '${'o'.repeat(1_100_000)}'\n`)
  await writeText(root, 'src/packages/profile/payload.ts', `export const payload = '${'p'.repeat(1_100_000)}'\n`)
  return root
}

describe.sequential('preload analyze CLI e2e', () => {
  it('reports real package budgets and exits naturally', async () => {
    const root = await createPreloadProject()

    try {
      const result = await execa('node', [
        CLI_PATH,
        'analyze',
        root,
        '--platform',
        'weapp',
        '--preload',
        '--json',
      ], {
        cwd: root,
        extendEnv: false,
        env: sanitizeBuildCommandEnv(),
        reject: false,
        timeout: 120_000,
      })

      expect(result.exitCode, result.stderr || result.stdout).toBe(0)
      const output = JSON.parse(result.stdout) as {
        suggestions: Array<{ page: string, packages: string[], alreadyConfigured: string[] }>
        budgets: Array<{
          sourcePackage: string
          status: string
          unknownPackages: string[]
          estimatedBytes: number
        }>
      }
      const mainSuggestion = output.suggestions.find(item => item.page === 'pages/index/index')
      expect(mainSuggestion).toMatchObject({
        alreadyConfigured: ['packages/order'],
        packages: ['packages/order', 'packages/profile'],
      })
      expect(output.suggestions).toContainEqual(expect.objectContaining({
        page: 'packages/independent/index',
        packages: ['__APP__'],
      }))
      expect(output.budgets).toContainEqual(expect.objectContaining({
        sourcePackage: '__main__',
        status: 'exceeded',
        unknownPackages: [],
      }))
      expect(output.budgets).toContainEqual(expect.objectContaining({
        sourcePackage: 'packages/independent',
        status: 'unknown',
        unknownPackages: ['packages/missing'],
      }))
    }
    finally {
      await fs.remove(root)
    }
  }, 150_000)
})
