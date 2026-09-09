import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { appendIdeReportEvent, resolveReportProjectPath } from './ideWarningReport'
import { resolveRuntimeProviderName } from './runtimeProvider'

async function observe(read: () => Promise<unknown>) {
  try {
    return { status: 'fulfilled', value: await read() }
  }
  catch (error) {
    return { status: 'rejected', error: error instanceof Error ? error.name : typeof error }
  }
}

async function captureFiles(miniProgram: any, distRoot: string, relativePaths: string[], markers: string[]) {
  const metadata = Reflect.get(miniProgram, '__WEAPP_VITE_SESSION_METADATA') as { projectPath?: string } | undefined
  const projectPath = metadata?.projectPath
  if (!projectPath) {
    throw new Error('Session metadata has no projectPath')
  }
  const readConfig = async (name: string) => {
    try {
      const config = JSON.parse(await fs.readFile(path.join(projectPath, name), 'utf8')) as {
        miniprogramRoot?: string
        srcMiniprogramRoot?: string
        libVersion?: string
        setting?: { compileHotReLoad?: boolean, es6?: boolean, ignoreDevUnusedFiles?: boolean }
      }
      return {
        miniprogramRoot: config.miniprogramRoot,
        srcMiniprogramRoot: config.srcMiniprogramRoot,
        libVersion: config.libVersion,
        setting: {
          compileHotReLoad: config.setting?.compileHotReLoad,
          es6: config.setting?.es6,
          ignoreDevUnusedFiles: config.setting?.ignoreDevUnusedFiles,
        },
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }
  const [publicConfig, privateConfig] = await Promise.all([readConfig('project.config.json'), readConfig('project.private.config.json')])
  const runtimeRoot = path.resolve(projectPath, privateConfig.miniprogramRoot ?? publicConfig.miniprogramRoot ?? '.')
  return {
    project: resolveReportProjectPath(projectPath),
    runtimeRoot: resolveReportProjectPath(runtimeRoot),
    publicConfig,
    privateConfig,
    files: await Promise.all(relativePaths.flatMap(relativePath => [
      { root: 'dist', file: path.join(distRoot, relativePath) },
      { root: 'runtime', file: path.join(runtimeRoot, relativePath) },
    ]).map(async ({ root, file }) => ({
      root,
      path: resolveReportProjectPath(file),
      result: await observe(async () => {
        const [bytes, stat] = await Promise.all([fs.readFile(file), fs.stat(file)])
        return { sha256: createHash('sha256').update(bytes).digest('hex'), size: stat.size, mtimeMs: stat.mtimeMs, markers: markers.map(marker => ({ marker, present: bytes.toString('utf8').includes(marker) })) }
      }),
    }))),
  }
}

/** 失败时并列记录真实节点、组件属性与存储，不修改页面或替代原验收结果。 */
export async function captureHmrProbeFailure(options: {
  miniProgram: any
  route: string
  storageKey: string
  expected: string
  files?: { distRoot: string, relativePaths: string[], markers?: string[] }
}) {
  const { miniProgram, route, storageKey, expected } = options
  const label = `probe-failure:${storageKey}`
  try {
    const page = await miniProgram.currentPage({ appFunctionFallback: false, retries: 1, timeout: 2_500 })
    const selectors = ['.title', '.marker', '.hero__eyebrow', '.hero__desc', '.layout-shared-template', '.layout-shared-include', '#layout-current']
    const [rendered, probes, storage, identity, files] = await Promise.all([
      observe(async () => await Promise.all(selectors.map(async (selector) => {
        return {
          selector,
          result: await observe(async () => {
            const elements = await page.getElementsByXpath(selector.startsWith('#')
              ? `//*[@id="${selector.slice(1)}"]`
              : `//*[contains(concat(" ", @class, " "), " ${selector.slice(1)} ")]`, { fallback: false, timeout: 2_500 })
            return await Promise.all(elements.map((element: any) => observe(async () => await element.text())))
          }),
        }
      }))),
      observe(async () => {
        const components = await page.$$('component', { fallback: false, timeout: 2_500 })
        const scopes = [page, ...components]
        return await Promise.all(scopes.map(async (scope, index) => ({
          scope: index,
          result: await observe(async () => {
            const children = await scope.$$('component', { fallback: false, timeout: 2_500 })
            return await Promise.all(children.map(async (component: any) => ({
              storageKey: await observe(async () => await component.property('storageKey')),
              marker: await observe(async () => await component.property('marker')),
            })))
          }),
        })))
      }),
      observe(async () => await miniProgram.callWxMethodWithOptions('getStorageSync', { timeout: 2_500 }, storageKey)),
      observe(async () => await miniProgram.evaluate(() => {
        const pages = getCurrentPages() as any[]
        const current = pages[pages.length - 1]
        const app = getApp() as any
        return {
          route: current?.route ?? current?.__route__ ?? null,
          nativePageId: current?.__wxWebviewId__ ?? current?.__webviewId__ ?? null,
          pageMarker: current?.__e2eHmrInstanceMarker ?? null,
          appMarker: app?.__e2eHmrInstanceMarker ?? null,
        }
      })),
      options.files ? observe(async () => await captureFiles(miniProgram, options.files!.distRoot, options.files!.relativePaths, options.files!.markers ?? [expected])) : undefined,
    ])
    const finalPage = await observe(async () => {
      const current = await miniProgram.currentPage({ appFunctionFallback: false, retries: 1, timeout: 2_500 })
      return { route: current?.path, pageId: current?.pageId }
    })
    const text = JSON.stringify({
      label,
      capturedAt: new Date().toISOString(),
      provider: resolveRuntimeProviderName(),
      expectedRoute: route,
      expected,
      storageKey,
      page: { route: page?.path, pageId: page?.pageId },
      rendered,
      probes,
      storage,
      identity,
      files,
      finalPage,
    })
    appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-probe-diagnostics', project: 'e2e-apps/wevu-runtime-e2e', label, text })
    process.stdout.write(`[hmr-probe-diagnostics] ${text}\n`)
  }
  catch (error) {
    process.stdout.write(`[hmr-probe-diagnostics] ${JSON.stringify({ label, error: error instanceof Error ? error.name : typeof error })}\n`)
  }
}
