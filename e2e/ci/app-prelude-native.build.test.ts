import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
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
    label: 'ci:app-prelude-native',
  })
}

describe.sequential('e2e app: app-prelude-native (build)', () => {
  it('injects app prelude before every main-package, subpackage, and independent-subpackage chunk', async () => {
    await runBuild()

    const appJsPath = path.join(DIST_ROOT, 'app.js')
    const mainPageJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const normalPageJsPath = path.join(DIST_ROOT, 'subpackages/normal/pages/entry/index.js')
    const independentPageJsPath = path.join(DIST_ROOT, 'subpackages/independent/pages/entry/index.js')

    expect(await fs.pathExists(appJsPath)).toBe(true)
    expect(await fs.pathExists(mainPageJsPath)).toBe(true)
    expect(await fs.pathExists(normalPageJsPath)).toBe(true)
    expect(await fs.pathExists(independentPageJsPath)).toBe(true)

    const jsFiles = (await fs.readdir(DIST_ROOT, { recursive: true }))
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
      .map(file => toPosixPath(file))

    expect(jsFiles).toContain('app.js')
    expect(jsFiles).toContain('pages/index/index.js')
    expect(jsFiles).toContain('subpackages/normal/pages/entry/index.js')
    expect(jsFiles).toContain('subpackages/independent/pages/entry/index.js')

    for (const relativeFile of jsFiles) {
      const absolutePath = path.join(DIST_ROOT, relativeFile)
      const content = await fs.readFile(absolutePath, 'utf8')
      expect(content).toContain('__weappViteAppPreludeRuntime__')
      expect(content).toContain('__weappViteAppPreludeInstalled__')
      expect(content).toContain('__appPreludeLog__')
      expect(content).toContain('app.prelude')
    }

    const appJs = await fs.readFile(appJsPath, 'utf8')
    const mainPageJs = await fs.readFile(mainPageJsPath, 'utf8')
    const normalPageJs = await fs.readFile(normalPageJsPath, 'utf8')
    const independentPageJs = await fs.readFile(independentPageJsPath, 'utf8')

    expect(appJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(appJs.indexOf('App('))
    expect(mainPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(mainPageJs.indexOf('Page('))
    expect(normalPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(normalPageJs.indexOf('Page('))
    expect(independentPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(independentPageJs.indexOf('Page('))
  })
})
