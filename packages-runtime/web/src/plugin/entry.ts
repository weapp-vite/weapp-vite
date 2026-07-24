import type { WxssTransformOptions } from '../css/wxss'

import type { ScanResult, WeappWebPluginOptions } from './types'
import { relativeModuleId, resolveRuntimePolyfillPath, toViteFsImport } from './path'

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

  for (const page of result.pages) {
    importLines.push(`import '${relativeModuleId(root, page.script)}'`)
  }
  for (const component of result.components) {
    importLines.push(`import '${relativeModuleId(root, component.script)}'`)
  }
  if (result.app) {
    importLines.push(`import '${relativeModuleId(root, result.app)}'`)
  }

  const pageOrder = result.pages.map(page => page.id)
  const useRuntimeRpx = wxssOptions?.pxPerRpx === undefined
    || (typeof wxssOptions.designWidth === 'number' && Number.isFinite(wxssOptions.designWidth))
  const rpxConfig = useRuntimeRpx
    ? { designWidth: wxssOptions?.designWidth ?? 750, varName: wxssOptions?.rpxVar }
    : undefined

  const initOptions: Record<string, any> = {}
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
  if (Object.keys(runtimeOptions).length > 0) {
    initOptions.runtime = runtimeOptions
  }

  const initOptionsCode = Object.keys(initOptions).length > 0 ? `, ${JSON.stringify(initOptions)}` : ''
  bodyLines.push(`initializePageRoutes(${JSON.stringify(pageOrder)}${initOptionsCode})`)
  return [...importLines, ...bodyLines].join('\n')
}
