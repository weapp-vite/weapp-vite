import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { attachRuntimeErrorCollector } from '../ide/runtimeErrors'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'

const externalProject = process.env.WEAPP_VITE_E2E_IMPORTS_PROJECT?.trim()
const root = externalProject ? path.resolve(externalProject) : undefined
const mainRoute = '/pages/index/index'
const independentRoute = '/independent/index/index'
const exactValue = 'imports-exact-key'

describe.skipIf(!externalProject)('published package imports runtime', { concurrent: false }, () => {
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let expectedText = ''

  beforeAll(async () => {
    const project = root!
    const manifest = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8')) as { imports?: Record<string, unknown> }
    const target = manifest.imports?.['#text/*']
    if (typeof target !== 'string' || !target.startsWith('./') || !target.includes('*')) {
      throw new Error('The isolated consumer must declare its #text/* fixture mapping')
    }
    expectedText = await readFile(path.resolve(project, target.replaceAll('*', 'value')), 'utf8')
    expect(expectedText).toMatch(/\bexport\s+const\s+marker\s*=/)
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as {
      pages?: string[]
      subPackages?: Array<{ root?: string, pages?: string[], independent?: boolean }>
    }
    expect(app.pages).toContain(mainRoute.slice(1))
    expect(app.subPackages?.find(entry => entry.root === 'independent')).toMatchObject({
      independent: true,
      pages: ['index/index'],
    })
    await Promise.all(['app.js', ...[mainRoute, independentRoute].flatMap(route => ['js', 'json', 'wxml'].map(extension => `${route.slice(1)}.${extension}`))]
      .map(file => access(path.join(project, 'dist', file))))
    // 只启动现有消费产物；机器租约、项目快照与窗口归属沿用正式 automator owner。
    miniProgram = await launchAutomator({
      projectPath: project,
      bridgeProjectMode: 'snapshot',
      launchMode: 'bridge',
      warmupRoute: mainRoute,
      warmupRootSelectors: ['.imports-text'],
      timeout: 120_000,
    })
  }, 120_000)

  afterAll(async () => {
    await miniProgram?.close()
  })

  it('renders wildcard raw sources and exact query keys in main and independent pages', async (context) => {
    const dom = createDomAcceptance(context, 'npm-consumer/package-imports', [
      { id: 'main-imports', route: mainRoute, action: '主包页面展示 imports 通配符的原始源码与精确 query 键导出', nodes: [{ selector: '.imports-text', text: expectedText }, { selector: '.imports-exact', text: exactValue }] },
      { id: 'independent-imports', route: independentRoute, action: '同一 runtime 进入独立分包并核对相同 imports 语义', nodes: [{ selector: '.imports-text', text: expectedText }, { selector: '.imports-exact', text: exactValue }] },
    ])
    if (!miniProgram) {
      throw new Error('The isolated consumer runtime was not launched')
    }
    const collector = attachRuntimeErrorCollector(miniProgram)
    try {
      const main = await miniProgram.reLaunch(mainRoute)
      await expect(main.data()).resolves.toMatchObject({ text: expectedText, exact: exactValue })
      await dom.check('main-imports', miniProgram, main)
      const independent = await miniProgram.reLaunch(independentRoute)
      await expect(independent.data()).resolves.toMatchObject({ text: expectedText, exact: exactValue })
      await dom.check('independent-imports', miniProgram, independent)
      expect(collector.getSince(0)).toEqual([])
    }
    finally {
      collector.dispose()
    }
  })
})
