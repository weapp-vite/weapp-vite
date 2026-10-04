import type { EncodedSourceMapLike } from '../../packages-runtime/wevu-compiler/src/utils/sourcemap'
import { integratedGlobalKey } from './integratedSource'

export const integratedMapTarget = 'packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/script.ts'
type MapInput = EncodedSourceMapLike | null | undefined
type Compose = (transformed: MapInput, original: MapInput) => EncodedSourceMapLike | null
type ComposeForSource = (transformed: MapInput, original: MapInput, sourceFile: string) => EncodedSourceMapLike | null

/** 仅对本次原样交付的 native map 选择 inline.ts 合成，模板来源直接保留。 */
export class IntegratedMapComposition {
  private readonly owned = new WeakSet<object>()
  private calls = 0
  private selectiveCalls = 0

  register(map: EncodedSourceMapLike) {
    this.owned.add(map)
  }

  snapshot() {
    return { calls: this.calls, selectiveCalls: this.selectiveCalls }
  }

  compose(transformed: MapInput, original: MapInput, compose: Compose, composeForSource: ComposeForSource) {
    this.calls++
    if (transformed && this.owned.has(transformed) && transformed.sources.length > 1) {
      this.selectiveCalls++
      return composeForSource(transformed, original, 'inline.ts')
    }
    return compose(transformed, original)
  }
}

/** 诊断加载器只替换最终合成点，原 JS 控制仍使用同一个生产函数。 */
export function instrumentIntegratedMap(source: string) {
  const replacements = [
    ['import { composeSourceMaps } from \'../../../../utils/sourcemap\'', 'import { composeSourceMaps, composeSourceMapForSource } from \'../../../../utils/sourcemap\''],
    ['scriptMap: composeSourceMaps(transformed.map ?? jsxTransformed.map, scriptMap)', `scriptMap: globalThis.${integratedGlobalKey}.maps.compose(transformed.map ?? jsxTransformed.map, scriptMap, composeSourceMaps, composeSourceMapForSource)`],
  ]
  for (const [anchor, replacement] of replacements) {
    if (!anchor || !replacement || source.split(anchor).length !== 2) {
      throw new Error(`Integrated map composition anchor changed: ${anchor}`)
    }
    source = source.replace(anchor, replacement)
  }
  return source
}
