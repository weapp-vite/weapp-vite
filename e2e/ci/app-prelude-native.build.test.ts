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

function findNonEntryJsFile(jsFiles: string[]) {
  const excluded = new Set([
    'app.js',
    'pages/index/index.js',
    'subpackages/normal/pages/entry/index.js',
    'subpackages/independent/pages/entry/index.js',
    'app.prelude.js',
    'subpackages/normal/app.prelude.js',
    'subpackages/independent/app.prelude.js',
  ])

  return jsFiles.find(file => !excluded.has(file))
}

async function runBuild(mode: 'inline' | 'entry' | 'require') {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ci:app-prelude-native:${mode}`,
    env: {
      APP_PRELUDE_MODE: mode,
    },
  })
}

async function runBuildWithRequestGlobalsPrelude(mode: 'inline' | 'entry' | 'require') {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ci:app-prelude-native:request-globals:${mode}`,
    env: {
      APP_PRELUDE_MODE: mode,
      APP_PRELUDE_REQUEST_GLOBALS: '1',
    },
  })
}

describe.sequential('e2e app: app-prelude-native (build)', () => {
  it('injects inline app prelude before every main-package, subpackage, and independent-subpackage chunk', async () => {
    await runBuild('inline')

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

    for (const relativeFile of [
      'app.js',
      'pages/index/index.js',
      'subpackages/normal/pages/entry/index.js',
      'subpackages/independent/pages/entry/index.js',
    ]) {
      const absolutePath = path.join(DIST_ROOT, relativeFile)
      const content = await fs.readFile(absolutePath, 'utf8')
      expect(content).toContain('__weappViteAppPreludeRuntime__')
      expect(content).toContain('__weappViteAppPreludeInstalled__')
      expect(content).toContain('__appPreludeLog__')
      expect(content).toContain('app.prelude')
      expect(content).not.toContain('import.meta.filename')
    }

    const appJs = await fs.readFile(appJsPath, 'utf8')
    const mainPageJs = await fs.readFile(mainPageJsPath, 'utf8')
    const normalPageJs = await fs.readFile(normalPageJsPath, 'utf8')
    const independentPageJs = await fs.readFile(independentPageJsPath, 'utf8')

    expect(appJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(appJs.indexOf('App('))
    expect(mainPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(mainPageJs.indexOf('Page('))
    expect(normalPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(normalPageJs.indexOf('Page('))
    expect(independentPageJs.indexOf('__weappViteAppPreludeRuntime__')).toBeLessThan(independentPageJs.indexOf('Page('))
    expect(appJs).toContain('app.prelude.ts:')
    expect(appJs).toContain('"/app.prelude.ts"')
    expect(mainPageJs).toContain('app.prelude.ts:')
    expect(mainPageJs).toContain('"/app.prelude.ts"')
  })

  it('injects app prelude into entry chunks only when mode is entry', async () => {
    await runBuild('entry')

    const jsFiles = (await fs.readdir(DIST_ROOT, { recursive: true }))
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
      .map(file => toPosixPath(file))
    const nonEntryJsFile = findNonEntryJsFile(jsFiles)
    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')
    const normalPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/normal/pages/entry/index.js'), 'utf8')
    const independentPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/independent/pages/entry/index.js'), 'utf8')
    expect(nonEntryJsFile).toBeTruthy()
    const nonEntryJs = await fs.readFile(path.join(DIST_ROOT, nonEntryJsFile!), 'utf8')

    expect(appJs).toContain('__weappViteAppPreludeRuntime__')
    expect(mainPageJs).toContain('__weappViteAppPreludeRuntime__')
    expect(normalPageJs).toContain('__weappViteAppPreludeRuntime__')
    expect(independentPageJs).toContain('__weappViteAppPreludeRuntime__')
    expect(nonEntryJs).not.toContain('__weappViteAppPreludeRuntime__')
  })

  it('emits scoped prelude modules and injects require calls when mode is require', async () => {
    await runBuild('require')

    const jsFiles = (await fs.readdir(DIST_ROOT, { recursive: true }))
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
      .map(file => toPosixPath(file))
    const nonEntryJsFile = findNonEntryJsFile(jsFiles)
    const rootPreludePath = path.join(DIST_ROOT, 'app.prelude.js')
    const normalPreludePath = path.join(DIST_ROOT, 'subpackages/normal/app.prelude.js')
    const independentPreludePath = path.join(DIST_ROOT, 'subpackages/independent/app.prelude.js')
    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')
    const normalPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/normal/pages/entry/index.js'), 'utf8')
    const independentPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/independent/pages/entry/index.js'), 'utf8')
    expect(nonEntryJsFile).toBeTruthy()
    const nonEntryJs = await fs.readFile(path.join(DIST_ROOT, nonEntryJsFile!), 'utf8')
    const rootPreludeJs = await fs.readFile(rootPreludePath, 'utf8')
    const normalPreludeJs = await fs.readFile(normalPreludePath, 'utf8')
    const independentPreludeJs = await fs.readFile(independentPreludePath, 'utf8')

    expect(await fs.pathExists(rootPreludePath)).toBe(true)
    expect(await fs.pathExists(normalPreludePath)).toBe(true)
    expect(await fs.pathExists(independentPreludePath)).toBe(true)

    expect(appJs).toContain('require("./app.prelude.js")')
    expect(mainPageJs).toContain('require("../../app.prelude.js")')
    expect(normalPageJs).toContain('require("../../app.prelude.js")')
    expect(independentPageJs).toContain('require("../../app.prelude.js")')
    expect(nonEntryJs).toContain('app.prelude.js')
    expect(appJs).not.toContain('__weappViteAppPreludeRuntime__')
    expect(nonEntryJs).not.toContain('__weappViteAppPreludeRuntime__')

    expect(rootPreludeJs).toContain('__weappViteAppPreludeRuntime__')
    expect(normalPreludeJs).toContain('__weappViteAppPreludeRuntime__')
    expect(independentPreludeJs).toContain('__weappViteAppPreludeRuntime__')
  })

  it('installs request globals through prelude before user app prelude when enabled', async () => {
    await runBuildWithRequestGlobalsPrelude('entry')

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')

    expect(appJs).toContain('__weappViteRequestGlobalsPrelude__')
    expect(mainPageJs).toContain('__weappViteRequestGlobalsPrelude__')
    expect(appJs.indexOf('__weappViteRequestGlobalsPrelude__')).toBeLessThan(appJs.indexOf('__weappViteAppPreludeRuntime__'))
    expect(mainPageJs.indexOf('__weappViteRequestGlobalsPrelude__')).toBeLessThan(mainPageJs.indexOf('__weappViteAppPreludeRuntime__'))
  })
})
