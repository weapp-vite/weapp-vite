import {
  APP_PRELUDE_CHUNK_MARKER,
  APP_PRELUDE_GUARD_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
} from '@weapp-core/constants'
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

async function runBuildWithDefaultMode() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ci:app-prelude-native:default',
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
  it('uses require mode by default and emits one scoped prelude module per package scope', async () => {
    await runBuildWithDefaultMode()

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')
    const normalPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/normal/pages/entry/index.js'), 'utf8')
    const independentPageJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/independent/pages/entry/index.js'), 'utf8')
    const rootPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'app.prelude.js'), 'utf8')
    const normalPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/normal/app.prelude.js'), 'utf8')
    const independentPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/independent/app.prelude.js'), 'utf8')

    expect(appJs).toContain('require("./app.prelude.js")')
    expect(mainPageJs).toContain('require("../../app.prelude.js")')
    expect(normalPageJs).toContain('require("../../app.prelude.js")')
    expect(independentPageJs).toContain('require("../../app.prelude.js")')
    expect(appJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(mainPageJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(normalPageJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(independentPageJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(rootPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(normalPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(independentPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
  })

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
      expect(content).toContain(APP_PRELUDE_CHUNK_MARKER)
      expect(content).toContain(APP_PRELUDE_GUARD_KEY)
      expect(content).toContain('__appPreludeLog__')
      expect(content).toContain('app.prelude')
      expect(content).not.toContain('import.meta.filename')
    }

    const appJs = await fs.readFile(appJsPath, 'utf8')
    const mainPageJs = await fs.readFile(mainPageJsPath, 'utf8')
    const normalPageJs = await fs.readFile(normalPageJsPath, 'utf8')
    const independentPageJs = await fs.readFile(independentPageJsPath, 'utf8')

    expect(appJs.indexOf(APP_PRELUDE_CHUNK_MARKER)).toBeLessThan(appJs.indexOf('App('))
    expect(mainPageJs.indexOf(APP_PRELUDE_CHUNK_MARKER)).toBeLessThan(mainPageJs.indexOf('Page('))
    expect(normalPageJs.indexOf(APP_PRELUDE_CHUNK_MARKER)).toBeLessThan(normalPageJs.indexOf('Page('))
    expect(independentPageJs.indexOf(APP_PRELUDE_CHUNK_MARKER)).toBeLessThan(independentPageJs.indexOf('Page('))
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

    expect(appJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(mainPageJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(normalPageJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(independentPageJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(nonEntryJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
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
    expect(appJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(nonEntryJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)

    expect(rootPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(normalPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(independentPreludeJs).toContain(APP_PRELUDE_CHUNK_MARKER)
  })

  it('installs request globals through prelude before user app prelude when enabled', async () => {
    await runBuildWithRequestGlobalsPrelude('entry')

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')

    expect(appJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(mainPageJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(appJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(appJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
    expect(mainPageJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(mainPageJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
  })

  it('emits request globals installer into app.prelude.js when mode is require', async () => {
    await runBuildWithRequestGlobalsPrelude('require')

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const rootPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'app.prelude.js'), 'utf8')
    const runtimeJs = await fs.readFile(path.join(DIST_ROOT, 'request-globals-runtime.js'), 'utf8')

    expect(appJs).toContain('require("./app.prelude.js")')
    expect(appJs).not.toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(rootPreludeJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(rootPreludeJs).toContain(`/* ${APP_PRELUDE_CHUNK_MARKER} */`)
    expect(rootPreludeJs).toContain('require("./request-globals-runtime.js")')
    expect(rootPreludeJs).toContain('"fetch","Headers","Request","Response"')
    expect(rootPreludeJs).not.toContain('"XMLHttpRequest"')
    expect(rootPreludeJs).not.toContain('"WebSocket"')
    expect(runtimeJs).toContain('Object.defineProperty(exports,`t`,{enumerable:!0,get:function(){return')
    expect(runtimeJs).toContain('targets??[`fetch`,`Headers`,`Request`,`Response`,`AbortController`,`AbortSignal`,`XMLHttpRequest`,`WebSocket`]')
    expect(rootPreludeJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(rootPreludeJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
  })
})
