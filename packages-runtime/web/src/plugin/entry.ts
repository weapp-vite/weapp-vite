import type { WxssTransformOptions } from '../css/wxss'

import type { ScanResult, WeappWebPluginOptions } from './types'
import { relativeModuleId, resolveRuntimePolyfillPath, toViteFsImport } from './path'

export function generateAutoRoutesModule(result: ScanResult) {
  const pages = result.pages.map(page => page.id)
  const subPackageMap = new Map<string, string[]>()
  for (const id of pages) {
    const pagesSegment = id.indexOf('/pages/')
    if (pagesSegment <= 0) {
      continue
    }
    const root = id.slice(0, pagesSegment)
    const route = id.slice(pagesSegment + 1)
    const routes = subPackageMap.get(root) ?? []
    routes.push(route)
    subPackageMap.set(root, routes)
  }
  const mainPages = pages.filter(id => !id.includes('/pages/'))
  const subPackages = [...subPackageMap].map(([root, routes]) => ({ root, pages: routes }))
  const snapshot = JSON.stringify({ pages: mainPages, entries: pages, subPackages })
  return [
    `const routes = ${snapshot}`,
    `const call = (name, options) => globalThis.wx?.[name]?.(options)`,
    `export const pages = routes.pages`,
    `export const entries = routes.entries`,
    `export const subPackages = routes.subPackages`,
    `export const miniProgramRouter = {`,
    `  switchTab: options => call('switchTab', options),`,
    `  reLaunch: options => call('reLaunch', options),`,
    `  redirectTo: options => call('redirectTo', options),`,
    `  navigateTo: options => call('navigateTo', options),`,
    `  navigateBack: options => call('navigateBack', options),`,
    `}`,
    `export const wxRouter = miniProgramRouter`,
    `export { routes }`,
    `export default routes`,
  ].join('\n')
}

export function generateEntryModule(
  result: ScanResult,
  root: string,
  wxssOptions?: WxssTransformOptions,
  pluginOptions?: WeappWebPluginOptions,
) {
  const runtimePolyfillId = pluginOptions?.__runtimeProvider?.moduleId
    ?? toViteFsImport(resolveRuntimePolyfillPath())
  const importLines: string[] = [`import { initializePageRoutes } from '${runtimePolyfillId}'`]
  const bodyLines: string[] = []

  if (result.app) {
    importLines.push(`import '${relativeModuleId(root, result.app)}'`)
  }
  for (const page of result.pages) {
    importLines.push(`import '${relativeModuleId(root, page.script)}'`)
  }
  for (const component of result.components) {
    importLines.push(`import '${relativeModuleId(root, component.script)}'`)
  }

  const pageOrder = result.pages.map(page => page.id)
  const useRuntimeRpx = wxssOptions?.pxPerRpx === undefined
    || (typeof wxssOptions.designWidth === 'number' && Number.isFinite(wxssOptions.designWidth))
  const rpxConfig = useRuntimeRpx
    ? { designWidth: wxssOptions?.designWidth ?? 750, varName: wxssOptions?.rpxVar }
    : undefined

  const initOptions: Record<string, any> = {}
  if (result.tabBar) {
    initOptions.tabBar = result.tabBar
  }
  if (rpxConfig) {
    initOptions.rpx = rpxConfig
  }
  if (pluginOptions?.form?.preventDefault !== undefined) {
    initOptions.form = { preventDefault: pluginOptions.form.preventDefault }
  }

  const runtimeOptions: Record<string, any> = {}
  if (pluginOptions?.runtime?.executionMode) {
    runtimeOptions.executionMode = pluginOptions.runtime.executionMode
  }
  if (pluginOptions?.runtime?.warnings) {
    runtimeOptions.warnings = pluginOptions.runtime.warnings
  }
  if (pluginOptions?.runtime?.viewport) {
    runtimeOptions.viewport = pluginOptions.runtime.viewport
  }
  if (pluginOptions?.runtime?.routing) {
    runtimeOptions.routing = pluginOptions.runtime.routing
  }
  if (pluginOptions?.runtime?.seo) {
    runtimeOptions.seo = pluginOptions.runtime.seo
  }
  if (pluginOptions?.runtime?.resourceHints) {
    runtimeOptions.resourceHints = pluginOptions.runtime.resourceHints
  }
  if (Object.keys(runtimeOptions).length > 0) {
    initOptions.runtime = runtimeOptions
  }

  const initOptionsCode = Object.keys(initOptions).length > 0 ? `, ${JSON.stringify(initOptions)}` : ''
  bodyLines.push(`initializePageRoutes(${JSON.stringify(pageOrder)}${initOptionsCode})`)
  return [...importLines, ...bodyLines].join('\n')
}
