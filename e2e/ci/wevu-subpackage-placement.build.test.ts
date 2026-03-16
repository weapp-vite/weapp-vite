import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/wevu-subpackage-placement')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/')
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:wevu-subpackage-placement',
  })
}

describe.sequential('e2e app: wevu-subpackage-placement (build)', () => {
  it('emits vue sfc outputs for main package, normal subpackage, and independent subpackage', async () => {
    await runBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const mainPageJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const mainPageWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const mainPageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    const mainComponentJsPath = path.join(DIST_ROOT, 'components/main-vue-card/index.js')
    const mainComponentWxmlPath = path.join(DIST_ROOT, 'components/main-vue-card/index.wxml')
    const nativeBadgeJsonPath = path.join(DIST_ROOT, 'native/native-badge/index.json')
    const normalEntryJsPath = path.join(DIST_ROOT, 'subpackages/normal-wevu/pages/entry/index.js')
    const normalDetailJsPath = path.join(DIST_ROOT, 'subpackages/normal-wevu/pages/detail/index.js')
    const independentEntryJsPath = path.join(DIST_ROOT, 'subpackages/independent-wevu/pages/entry/index.js')
    const independentDetailJsPath = path.join(DIST_ROOT, 'subpackages/independent-wevu/pages/detail/index.js')
    const mainSharedChunkPath = path.join(DIST_ROOT, 'common.js')
    const normalSharedChunkPath = path.join(DIST_ROOT, 'subpackages/normal-wevu/common.js')
    const independentSharedChunkPath = path.join(DIST_ROOT, 'subpackages/independent-wevu/independentState.js')

    expect(await fs.pathExists(appJsonPath)).toBe(true)
    expect(await fs.pathExists(mainPageJsPath)).toBe(true)
    expect(await fs.pathExists(mainPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(mainPageJsonPath)).toBe(true)
    expect(await fs.pathExists(mainComponentJsPath)).toBe(true)
    expect(await fs.pathExists(mainComponentWxmlPath)).toBe(true)
    expect(await fs.pathExists(nativeBadgeJsonPath)).toBe(true)
    expect(await fs.pathExists(normalEntryJsPath)).toBe(true)
    expect(await fs.pathExists(normalDetailJsPath)).toBe(true)
    expect(await fs.pathExists(independentEntryJsPath)).toBe(true)
    expect(await fs.pathExists(independentDetailJsPath)).toBe(true)
    expect(await fs.pathExists(mainSharedChunkPath)).toBe(true)
    expect(await fs.pathExists(normalSharedChunkPath)).toBe(true)
    expect(await fs.pathExists(independentSharedChunkPath)).toBe(true)

    const appJson = await fs.readJson(appJsonPath)
    const mainPageJs = await fs.readFile(mainPageJsPath, 'utf8')
    const mainPageWxml = await fs.readFile(mainPageWxmlPath, 'utf8')
    const mainPageJson = await fs.readJson(mainPageJsonPath)
    const mainComponentJs = await fs.readFile(mainComponentJsPath, 'utf8')
    const mainComponentWxml = await fs.readFile(mainComponentWxmlPath, 'utf8')
    const normalEntryJs = await fs.readFile(normalEntryJsPath, 'utf8')
    const normalDetailJs = await fs.readFile(normalDetailJsPath, 'utf8')
    const independentEntryJs = await fs.readFile(independentEntryJsPath, 'utf8')
    const independentDetailJs = await fs.readFile(independentDetailJsPath, 'utf8')
    const mainSharedChunk = await fs.readFile(mainSharedChunkPath, 'utf8')
    const normalSharedChunk = await fs.readFile(normalSharedChunkPath, 'utf8')
    const independentSharedChunk = await fs.readFile(independentSharedChunkPath, 'utf8')

    expect(appJson.pages).toEqual(['pages/index/index'])
    expect(appJson.subPackages).toEqual([
      {
        root: 'subpackages/normal-wevu',
        pages: ['pages/entry/index', 'pages/detail/index'],
      },
      {
        root: 'subpackages/independent-wevu',
        pages: ['pages/entry/index', 'pages/detail/index'],
        independent: true,
      },
    ])

    expect(mainPageJson.usingComponents).toEqual({
      'MainVueCard': '/components/main-vue-card/index',
      'native-badge': '/native/native-badge/index',
    })
    expect(mainPageJs).toContain('require(`../../common.js`)')
    expect(mainPageJs).toContain('runE2E')
    expect(mainPageJs).toContain('MainVueCard')
    expect(mainPageWxml).toContain('__WSP_MAIN_VUE__')
    expect(mainPageWxml).toContain('<MainVueCard')
    expect(mainPageWxml).toContain('<native-badge')
    expect(mainComponentJs).toContain('props:{title:null,count:null,double:null}')
    expect(mainComponentJs).toContain('setup(e,{expose:t})')
    expect(mainComponentWxml).toContain('{{props.title}}')
    expect(mainComponentWxml).toContain('{{props.count}}')
    expect(mainComponentWxml).toContain('{{props.double}}')

    expect(mainSharedChunk).toContain('__wevuAppRegistered')
    expect(mainSharedChunk).toContain('Object.defineProperty(exports,`o`')
    expect(mainSharedChunk).toContain('Object.defineProperty(exports,`a`')

    expect(mainPageJs).toContain('/subpackages/normal-wevu/pages/entry/index')
    expect(mainPageJs).toContain('/subpackages/independent-wevu/pages/entry/index')

    expect(normalEntryJs).toContain('require(`../../common.js`)')
    expect(normalEntryJs).toContain('goIndependent')
    expect(normalDetailJs).toContain('require(`../../common.js`)')
    expect(normalDetailJs).toContain('from.value')

    expect(independentEntryJs).toContain('require(`../../independentState.js`)')
    expect(independentEntryJs).toContain('goNormal')
    expect(independentDetailJs).toContain('require(`../../independentState.js`)')
    expect(independentDetailJs).toContain('from.value')

    expect(normalSharedChunk).toContain('count:t')
    expect(normalSharedChunk).toContain('from:e.o(`direct`)')
    expect(normalSharedChunk).toContain('double:e.a(()=>t.value*2)')

    expect(independentSharedChunk).toContain('count:ai')
    expect(independentSharedChunk).toContain('from:Se(`direct`)')
    expect(independentSharedChunk).toContain('double:we(()=>ai.value*2)')

    const distJsFiles = (await fs.readdir(DIST_ROOT, { recursive: true }))
      .filter(file => typeof file === 'string' && file.endsWith('.js'))
      .map(file => toPosixPath(file))

    expect(distJsFiles.includes('common.js')).toBe(true)
    expect(distJsFiles.some(file => file.includes('subpackages/normal-wevu/common.js'))).toBe(true)
    expect(distJsFiles.some(file => file.includes('subpackages/independent-wevu/independentState.js'))).toBe(true)
    expect(distJsFiles.includes('pages/index/index.js')).toBe(true)
  })
})
