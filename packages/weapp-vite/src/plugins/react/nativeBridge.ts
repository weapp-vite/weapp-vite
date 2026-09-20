import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'

/** 原生 bridge 校验读取当前产物或入口元数据，局部构建不要求重发未变化的 JSON。 */
export function validateNativeBridgeConfiguration(
  ctx: CompilerContext,
  bundle: OutputBundle,
  fileName: string,
  nativeComponents: string[],
) {
  const jsonFileName = fileName.replace(/\.wxml$/, '.json')
  const jsonAsset = bundle[jsonFileName]
  const entry = ctx.runtimeState?.build?.hmr?.entriesMap.get(jsonFileName.replace(/\.json$/, ''))
  const source = jsonAsset?.type === 'asset'
    ? String(jsonAsset.source)
    : jsonAsset === undefined && entry?.json
      ? ctx.jsonService.resolve(entry)
      : undefined
  if (source === undefined) {
    throw new Error(`[react] ${fileName} 使用了原生组件 bridge，但缺少对应配置 ${jsonFileName}`)
  }
  let json: unknown
  try {
    json = JSON.parse(source) as unknown
  }
  catch (error) {
    throw new Error(`[react] 无法解析原生组件配置 ${jsonFileName}`, { cause: error })
  }
  const usingComponents = json && typeof json === 'object' && !Array.isArray(json) && 'usingComponents' in json
    ? json.usingComponents
    : undefined
  const registered = usingComponents && typeof usingComponents === 'object' && !Array.isArray(usingComponents)
    ? usingComponents as Record<string, unknown>
    : {}
  const missing = nativeComponents.filter(tag => typeof registered[tag] !== 'string')
  if (missing.length > 0) {
    throw new Error(`[react] ${fileName} 的原生组件 bridge 未在 ${jsonFileName} 的 usingComponents 注册：${missing.join(', ')}`)
  }
}
