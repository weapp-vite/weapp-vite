import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readdir, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'

// Issue #925 未提供原始复现项目；此处以原生页面构造最小等价复现，
// 严格使用推荐配置 build.assetsDir='[subpackage]/assets' 且不显式设置 assetFileNames。
const MAIN = 'pages/index/index'
const FEATURE = 'packages/feature/pages/index/index'
const STANDALONE = 'packages/standalone/pages/index/index'
const SHARED_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const EXCLUSIVE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg2MIAAAFsALURRL1oAAAAAElFTkSuQmCC', 'base64')
const STANDALONE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC', 'base64')
const imageInfo = (expression: string) => `new Promise(resolve => wx.getImageInfo({ src: ${expression}, success: result => resolve({ ok: true, type: result.type }), fail: error => resolve({ ok: false, message: error.errMsg }) }))`

const featureCheckpoint = {
  id: 'asset:feature',
  route: `/${FEATURE}`,
  action: '打开普通分包页面，读取共享图与独占图并检查可见节点',
  nodes: [{ selector: '#asset' }, { selector: '#exclusive' }, { selector: 'text', text: 'feature' }],
}
const standaloneCheckpoint = {
  id: 'asset:standalone',
  route: `/${STANDALONE}`,
  action: '直接启动独立分包页面，读取本包图片并检查可见节点',
  nodes: [{ selector: '#asset' }, { selector: 'text', text: 'standalone' }],
}

async function createFixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'subpackage-recommended-')))
  const source = (file: string) => path.join(root, 'src', file)
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'node_modules'), { recursive: true })
  await symlink(path.resolve(import.meta.dirname, '../../packages/weapp-vite'), path.join(root, 'node_modules/weapp-vite'), 'junction')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'subpackage-recommended', private: true, type: 'module' }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({
    appid: 'wx6ffee4673b257014',
    compileType: 'miniprogram',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'src/',
    setting: {},
  }))
  await writeFile(path.join(root, 'project.private.config.json'), JSON.stringify({
    condition: {
      miniprogram: {
        list: [MAIN, FEATURE, STANDALONE].map(route => ({ name: route, pathName: route, query: '' })),
      },
    },
  }))
  await writeFile(path.join(root, 'vite.config.mts'), `
import { defineConfig } from 'weapp-vite/config'
export default defineConfig({
  weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
  build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
})
`)
  await writeFile(source('app.json'), JSON.stringify({
    pages: [MAIN],
    subPackages: [
      { root: 'packages/feature', pages: ['pages/index/index'] },
      { root: 'packages/standalone', pages: ['pages/index/index'], independent: true },
    ],
  }))
  await writeFile(source('app.js'), 'App({})')
  await writeFile(source('shared.png'), SHARED_PNG)
  await writeFile(source('exclusive.png'), EXCLUSIVE_PNG)

  await mkdir(source('pages/index'), { recursive: true })
  await writeFile(source('pages/index/index.js'), `import image from '../../shared.png'
Page({ data: { image }, runE2E() { return ${imageInfo('this.data.image')} } })`)
  await writeFile(source('pages/index/index.wxml'), '<view class="page"><image id="asset" src="{{image}}"/><text>main</text></view>')
  await writeFile(source('pages/index/index.json'), '{}')
  // WXSS 不支持本地背景图，页面样式保持为空；图片加载改由 JS 导入 + <image> 验证。
  await writeFile(source('pages/index/index.wxss'), '')

  await mkdir(source('packages/feature/pages/index'), { recursive: true })
  await writeFile(source('packages/feature/pages/index/index.js'), `import shared from '../../../../shared.png'
import exclusive from '../../../../exclusive.png'
Page({
  data: { image: shared, exclusive },
  runE2E() { return Promise.all([${imageInfo('shared')}, ${imageInfo('exclusive')}]) },
})`)
  await writeFile(source('packages/feature/pages/index/index.wxml'), '<view class="page"><image id="asset" src="{{image}}"/><image id="exclusive" src="{{exclusive}}"/><text>feature</text></view>')
  await writeFile(source('packages/feature/pages/index/index.json'), '{}')
  await writeFile(source('packages/feature/pages/index/index.wxss'), '')

  await mkdir(source('packages/standalone/pages/index'), { recursive: true })
  await writeFile(source('packages/standalone/standalone.png'), STANDALONE_PNG)
  await writeFile(source('packages/standalone/pages/index/index.js'), `import image from '../../standalone.png'
Page({ data: { image }, runE2E() { return ${imageInfo('this.data.image')} } })`)
  await writeFile(source('packages/standalone/pages/index/index.wxml'), '<view class="page"><image id="asset" src="{{image}}"/><text>standalone</text></view>')
  await writeFile(source('packages/standalone/pages/index/index.json'), '{}')
  await writeFile(source('packages/standalone/pages/index/index.wxss'), '')

  return { root, close: async () => rm(root, { recursive: true, force: true }) }
}

async function emitted(dist: string, prefix = '') {
  const files = (await readdir(path.join(dist, prefix), { recursive: true })).map(file => path.normalize(file).replaceAll('\\', '/'))
  return files.filter(file => file.endsWith('.png') && path.posix.dirname(file) === 'assets').map(file => path.posix.join(prefix, file))
}

async function packageBytes(dist: string, directory = '') {
  const files = await readdir(path.join(dist, directory), { recursive: true })
  let bytes = 0
  for (const file of files) {
    const target = path.join(dist, directory, file)
    const info = await stat(target)
    if (info.isFile()) {
      bytes += info.size
    }
  }
  return bytes
}

describe('subpackage output with recommended config in real DevTools', { concurrent: false }, () => {
  let fixture: Awaited<ReturnType<typeof createFixture>> | undefined
  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
  let paths: { shared: string, exclusive: string, standalone: string } | undefined

  beforeAll(async () => {
    fixture = await createFixture()
    const cliPath = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
    await runWeappViteBuildWithLogCapture({ cliPath, projectRoot: fixture.root, platform: 'weapp', cwd: fixture.root, label: 'ide:subpackage-output-recommended' })
    const dist = path.join(fixture.root, 'dist')
    const mainAssets = await emitted(dist)
    const featureAssets = await emitted(dist, 'packages/feature')
    const standaloneAssets = await emitted(dist, 'packages/standalone')
    expect(mainAssets).toHaveLength(1)
    expect(featureAssets).toHaveLength(1)
    expect(standaloneAssets).toHaveLength(1)
    paths = { shared: mainAssets[0]!, exclusive: featureAssets[0]!, standalone: standaloneAssets[0]! }
    expect(paths.shared).toMatch(/^assets\/shared-[^/]+\.png$/)
    expect(paths.exclusive).toMatch(/^packages\/feature\/assets\/exclusive-[^/]+\.png$/)
    expect(paths.standalone).toMatch(/^packages\/standalone\/assets\/standalone-[^/]+\.png$/)
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file).replaceAll('\\', '/'))
    expect(files.filter(file => file.endsWith('.png'))).toHaveLength(3)
    expect(files.some(file => file.endsWith('.png') && file.includes('exclusive') && !file.startsWith('packages/feature/'))).toBe(false)
    expect(files.some(file => file.endsWith('.png') && file.includes('standalone') && !file.startsWith('packages/standalone/'))).toBe(false)
    const mainBytes = await packageBytes(dist)
    const featureBytes = await packageBytes(dist, 'packages/feature')
    const standaloneBytes = await packageBytes(dist, 'packages/standalone')
    expect(mainBytes).toBeGreaterThan(0)
    expect(featureBytes).toBeGreaterThan(0)
    expect(standaloneBytes).toBeGreaterThan(0)
    console.log(`[recommended-pkg-size] main=${mainBytes} feature=${featureBytes} standalone=${standaloneBytes}`)
    miniProgram = await launchAutomator({
      projectPath: fixture.root,
      timeout: 120_000,
      warmupRootSelectors: ['.page'],
      warmupRoute: MAIN,
    })
  }, 240_000)

  afterAll(async () => {
    await miniProgram?.close()
    await fixture?.close()
  })

  it('loads shared and exclusive images from a normal subpackage page', async (context) => {
    const runtime = miniProgram!
    const dom = createDomAcceptance(context, 'subpackage-output-recommended', [featureCheckpoint])
    const page = await runtime.reLaunch(featureCheckpoint.route)
    expect(page).toBeTruthy()
    expect(await page!.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual([{ ok: true, type: 'png' }, { ok: true, type: 'png' }])
    expect(await page!.data()).toMatchObject({ image: `/${paths!.shared}`, exclusive: `/${paths!.exclusive}` })
    await dom.check(featureCheckpoint.id, runtime, page!)
  })

  it('loads its own image when the independent subpackage starts directly', async (context) => {
    const runtime = miniProgram!
    const dom = createDomAcceptance(context, 'subpackage-output-recommended', [standaloneCheckpoint])
    const page = await runtime.reLaunch(standaloneCheckpoint.route)
    expect(page).toBeTruthy()
    expect(await page!.callMethodWithOptions('runE2E', { routeOnly: true })).toEqual({ ok: true, type: 'png' })
    expect(await page!.data()).toMatchObject({ image: `/${paths!.standalone}` })
    await dom.check(standaloneCheckpoint.id, runtime, page!)
  })
})
