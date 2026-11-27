import {
  APP_PRELUDE_CHUNK_MARKER,
  APP_PRELUDE_GUARD_KEY,
  APP_PRELUDE_REQUIRE_MARKER,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_PRELUDE_GUARD_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
} from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRelativeModuleReferences, resolveRequestGlobalsInstaller } from '../utils/requestGlobalsInstaller'
import { toRelativeImport } from '../utils/wevu-vendor'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/')
}

/** 判断产物是否使用 `globalThis.<guardKey>` 形式的一次性 Prelude 守卫。 */
function usesGlobalPreludeGuard(code: string) {
  return new RegExp(`globalThis(?:\\.${APP_PRELUDE_GUARD_KEY}|\\[['"]${APP_PRELUDE_GUARD_KEY}["']\\])`, 'u').test(code)
}

function findNonEntryJsFile(jsFiles: string[]) {
  const excluded = new Set([
    'app.js',
    'pages/index/index.js',
    'pages/native-api/index.js',
    'pages/native-vue/index.js',
    'subpackages/normal/pages/entry/index.js',
    'subpackages/independent/pages/entry/index.js',
    'app.prelude.js',
    'subpackages/normal/app.prelude.js',
    'subpackages/independent/app.prelude.js',
  ])

  return jsFiles.find(file => !excluded.has(file))
}

async function runBuild(mode: 'inline' | 'entry' | 'require' | 'native') {
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

async function runBuildWithRequestGlobals(mode: 'inline' | 'entry' | 'require' | 'native', options: { nativeFetchOverride?: boolean, es5Minify?: boolean } = {}) {
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
      ...(options.nativeFetchOverride ? { APP_PRELUDE_NATIVE_FETCH_OVERRIDE: '1' } : {}),
      ...(options.es5Minify ? { APP_PRELUDE_ES5_MINIFY: '1' } : {}),
    },
  })
}

async function readJavaScriptGraph() {
  const jsFiles = (await fs.readdir(DIST_ROOT, { recursive: true }))
    .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
    .map(file => toPosixPath(file))
  const codeByFile = new Map(await Promise.all(jsFiles.map(async file => [file, await fs.readFile(path.join(DIST_ROOT, file), 'utf8')] as const)))
  return { jsFiles, codeByFile }
}

async function resolveClosure(entryFile: string, codeByFile: Map<string, string>) {
  const reached = new Set<string>()
  const pending = [entryFile]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (reached.has(file)) {
      continue
    }
    reached.add(file)
    const code = codeByFile.get(file)
    if (code === undefined) {
      throw new Error(`Missing emitted module ${file}`)
    }
    const references = await resolveRelativeModuleReferences(DIST_ROOT, path.join(DIST_ROOT, file), code)
    pending.push(...references.map(reference => toPosixPath(path.relative(DIST_ROOT, reference))))
  }
  return reached
}

function resolveNativeBindingFiles(reached: Set<string>, codeByFile: Map<string, string>) {
  return [...reached].filter(file => codeByFile.get(file)?.includes('weapp-vite:web-runtime:bindings'))
}

describe('e2e app: app-prelude-native (build)', { concurrent: false }, () => {
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

  it('uses precise native bindings and target-scoped global bridges per package scope', async () => {
    await runBuildWithRequestGlobals('native')

    const { jsFiles, codeByFile } = await readJavaScriptGraph()
    const independentEntry = 'subpackages/independent/pages/entry/index.js'
    const rootEntries = [
      'pages/index/index.js',
      'pages/native-api/index.js',
      'pages/native-vue/index.js',
      'subpackages/normal/pages/entry/index.js',
    ]
    const allCode = [...codeByFile.values()].join('\n')

    expect(allCode).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall|axiosEnv|eagerBindings|__wvAXFE__/u)
    // 未显式开启 native prelude 时不生成独立 shim vendor，拆分完全交给打包器。
    expect(jsFiles).not.toContain('weapp-vendors/shim.js')
    // native 的自定义 Prelude 是普通模块，一次性守卫必须与该模块导出的 `runAppPrelude` 同块出现；
    // legacy scoped `app.prelude.js` 的 IIFE 守卫没有这个定义，因此该断言仍可拦截旧产物回落。
    for (const [file, code] of codeByFile) {
      if (usesGlobalPreludeGuard(code)) {
        expect(code, `${file} may only guard an exported prelude runner`).toContain('function runAppPrelude')
      }
    }
    for (const legacyPrelude of ['app.prelude.js', 'subpackages/normal/app.prelude.js', 'subpackages/independent/app.prelude.js']) {
      expect(jsFiles, legacyPrelude).not.toContain(legacyPrelude)
    }
    for (const entry of ['app.js', ...rootEntries]) {
      const closure = await resolveClosure(entry, codeByFile)
      expect(resolveNativeBindingFiles(closure, codeByFile).length, entry).toBeGreaterThan(0)
      expect(codeByFile.get(entry), entry).not.toContain(REQUEST_GLOBAL_BUNDLE_MARKER)
    }

    const independentClosure = await resolveClosure(independentEntry, codeByFile)
    expect(resolveNativeBindingFiles(independentClosure, codeByFile).length, independentEntry).toBeGreaterThan(0)
    const rootBindingFiles = resolveNativeBindingFiles(await resolveClosure('app.js', codeByFile), codeByFile)
    for (const bindingFile of rootBindingFiles) {
      expect(independentClosure.has(bindingFile), `${independentEntry} must not import ${bindingFile}`).toBe(false)
    }

    const axiosClosure = await resolveClosure('axios.js', codeByFile)
    const axiosCode = [...axiosClosure].map(file => codeByFile.get(file) ?? '').join('\n')
    expect(resolveNativeBindingFiles(axiosClosure, codeByFile).length).toBeGreaterThan(0)
    // axios 只对源码里真实存在的全局语义生成桥接：它读取全局 fetch/URL，并通过网络 defaults 的普通依赖生效。
    expect(axiosCode).toContain('Reflect.set(globalThis, "fetch"')
    expect(axiosCode).toContain('Reflect.set(globalThis, "URL"')
    expect(axiosCode).toContain('setMiniProgramNetworkDefaults')

    // `globalTargets` 声明的隐藏访问必须在主包入口闭包内生成幂等桥接，不依赖 axios 专用补丁。
    const appClosure = await resolveClosure('app.js', codeByFile)
    const appCode = [...appClosure].map(file => codeByFile.get(file) ?? '').join('\n')
    for (const target of ['fetch', 'Request', 'Response']) {
      expect(appCode, `globalTargets bridge for ${target}`).toContain(`Reflect.set(globalThis, ${JSON.stringify(target)}`)
      expect(appCode, `idempotent guard for ${target}`).toContain(`Reflect.get(globalThis, ${JSON.stringify(target)}`)
    }
    // 未开启 prelude 时安装范围仍精确收敛：既未声明也未源码检测到的目标不得写入全局。
    // 与上方 `globalTargets` 断言相对，这里挑选的目标在 fixture 源码里只作为自由标识符使用。
    for (const target of ['XMLHttpRequest', 'WebSocket', 'EventSource']) {
      expect(allCode, `unrequested ${target} must stay module-local`).not.toContain(`Reflect.set(globalThis, ${JSON.stringify(target)}`)
    }
  })

  it('emits the custom app prelude as an independent vendor chunk without a forced shim', async () => {
    await runBuildWithRequestGlobals('native')

    const { jsFiles, codeByFile } = await readJavaScriptGraph()
    const allCode = [...codeByFile.values()].join('\n')
    const preludeChunk = 'weapp-vendors/web-runtime-app-prelude.js'

    // 精确优先：不强制 shim vendor；自定义 App Prelude 仍由唯一一条分组规则独立成块。
    expect(jsFiles).not.toContain('weapp-vendors/shim.js')
    expect(jsFiles, preludeChunk).toContain(preludeChunk)
    expect(allCode).not.toMatch(/installWebRuntime|createWebRuntimeInstallContext|finalizeWebRuntimeInstall|axiosEnv|eagerBindings|__wvAXFE__/u)
    expect(codeByFile.get(preludeChunk) ?? '').toContain('function runAppPrelude')

    // 根入口依赖独立 Prelude vendor；Prelude 不反向依赖业务入口。
    const appClosure = await resolveClosure('app.js', codeByFile)
    expect(appClosure.has(preludeChunk), 'app.js must require the app prelude vendor').toBe(true)
    const preludeReferences = await resolveRelativeModuleReferences(DIST_ROOT, path.join(DIST_ROOT, preludeChunk), codeByFile.get(preludeChunk) ?? '')
    expect(preludeReferences.map(reference => toPosixPath(path.relative(DIST_ROOT, reference)))).not.toContain('app.js')

    // globalTargets 声明的隐藏访问在主包入口闭包内精确桥接。
    const appCode = [...appClosure].map(file => codeByFile.get(file) ?? '').join('\n')
    for (const target of ['fetch', 'Request', 'Response']) {
      expect(appCode, `globalTargets bridge for ${target}`).toContain(`Reflect.set(globalThis, ${JSON.stringify(target)}`)
    }

    // 独立分包保持自包含：不跨包引用主包 Prelude vendor。
    const independentEntry = 'subpackages/independent/pages/entry/index.js'
    const independentClosure = await resolveClosure(independentEntry, codeByFile)
    expect(independentClosure.has(preludeChunk), `${independentEntry} must not import ${preludeChunk}`).toBe(false)
    expect(resolveNativeBindingFiles(independentClosure, codeByFile).length, independentEntry).toBeGreaterThan(0)
  })

  it('keeps native global bridges ES5-compatible under the minify profile', async () => {
    await runBuildWithRequestGlobals('native', { es5Minify: true })

    const { codeByFile } = await readJavaScriptGraph()
    const allCode = [...codeByFile.values()].join('\n')
    // 精确桥接逐目标读写全局；ES5 + 压缩下含全局写入的产物不得残留 ES2015+ 语法，读取字面量压缩后仍稳定。
    const bridgeFiles = [...codeByFile.entries()].filter(([, code]) => /Reflect\.set\(globalThis/u.test(code))
    expect(bridgeFiles.length).toBeGreaterThan(0)
    for (const [file, code] of bridgeFiles) {
      expect(code, `${file} must stay ES5`).not.toMatch(/=>|\b(?:const|let)\s/u)
    }
    for (const target of ['fetch', 'Request', 'Response']) {
      expect(allCode, `globalTargets bridge for ${target}`).toMatch(new RegExp(`Reflect\\.set\\(globalThis,\\s*${JSON.stringify(target)}`, 'u'))
    }
    expect(allCode).not.toMatch(/installWebRuntime|axiosEnv|eagerBindings|__wvAXFE__/u)
  })

  it('uses user inject overrides for native global bridges without an axios patch', async () => {
    await runBuildWithRequestGlobals('native', { nativeFetchOverride: true })

    const { codeByFile } = await readJavaScriptGraph()
    const axiosClosure = await resolveClosure('axios.js', codeByFile)
    const axiosCode = [...axiosClosure].map(file => codeByFile.get(file) ?? '').join('\n')
    expect(axiosCode).toContain('native-override')
    expect(axiosCode).toContain('Reflect.set(globalThis, "fetch"')
    expect([...codeByFile.values()].join('\n')).not.toMatch(/axiosEnv|__wvAXFE__/u)
  })

  it('installs request globals through prelude before user app prelude when enabled', async () => {
    await runBuildWithRequestGlobals('entry')

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const mainPageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/index/index.js'), 'utf8')

    expect(appJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(mainPageJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(appJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(appJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
    expect(mainPageJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(mainPageJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
  })

  it('shares one external request globals installer between app and prelude when mode is require', async () => {
    await runBuildWithRequestGlobals('require')

    const appJs = await fs.readFile(path.join(DIST_ROOT, 'app.js'), 'utf8')
    const rootPreludeJs = await fs.readFile(path.join(DIST_ROOT, 'app.prelude.js'), 'utf8')
    const installer = await resolveRequestGlobalsInstaller(DIST_ROOT)
    const installerJs = installer.code
    const appPath = path.join(DIST_ROOT, 'app.js')
    const preludePath = path.join(DIST_ROOT, 'app.prelude.js')
    const installerRequire = `require(${JSON.stringify(toRelativeImport(appPath, installer.path))})`
    const appReferences = await resolveRelativeModuleReferences(DIST_ROOT, appPath, appJs)
    const preludeReferences = await resolveRelativeModuleReferences(DIST_ROOT, preludePath, rootPreludeJs)
    expect(appReferences).toContain(installer.path)
    expect(preludeReferences).toContain(installer.path)

    expect(appJs).toContain('require("./app.prelude.js")')
    expect(appJs).not.toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(appJs).toContain(installerRequire)
    expect(appJs).not.toContain(REQUEST_GLOBAL_BUNDLE_MARKER)
    expect(installerJs).toContain(REQUEST_GLOBAL_BUNDLE_MARKER)
    expect(installerJs).not.toContain(APP_PRELUDE_REQUIRE_MARKER)
    expect(installerJs).not.toContain(APP_PRELUDE_CHUNK_MARKER)
    expect(appJs).toContain('installWebRuntimeGlobals')
    expect(rootPreludeJs).toContain(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)
    expect(rootPreludeJs).toContain(`/* ${APP_PRELUDE_CHUNK_MARKER} */`)
    expect(rootPreludeJs).toContain(installerRequire)
    expect(rootPreludeJs).toContain(JSON.stringify(REQUEST_GLOBAL_PRELUDE_GUARD_KEY))
    expect(rootPreludeJs).toContain('"fetch","Headers","Request","Response"')
    expect(rootPreludeJs).not.toContain('"XMLHttpRequest"')
    expect(rootPreludeJs).not.toContain('"WebSocket"')
    expect(rootPreludeJs.indexOf(`/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`)).toBeLessThan(rootPreludeJs.indexOf(`/* ${APP_PRELUDE_CHUNK_MARKER} */`))
  })
})
