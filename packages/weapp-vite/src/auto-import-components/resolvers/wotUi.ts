import type { Options, ResolverObject } from './types'
import { defu } from '@weapp-core/shared'
import components from './json/wotUi.json'

export interface WotUiResolverOptions extends Pick<Options, 'supportFilesStrategy'> {
  prefix?: string
}

const PACKAGE_NAME = '@wot-ui/ui'

/**
 * 创建 Wot UI 的 Vue SFC 自动导入解析器。
 */
export function WotUiResolver(options?: WotUiResolverOptions): ResolverObject {
  const resolvedOptions = defu<Required<WotUiResolverOptions>, WotUiResolverOptions[]>(options, {
    prefix: 'wd-',
    supportFilesStrategy: 'used',
  })
  const componentMap = Object.fromEntries(components.map((componentName) => {
    const suffix = componentName.slice('wd-'.length)
    const name = `${resolvedOptions.prefix}${suffix}`
    return [name, `${PACKAGE_NAME}/components/${componentName}/${componentName}.vue`]
  }))

  return {
    components: Object.freeze(componentMap),
    supportFilesStrategy: resolvedOptions.supportFilesStrategy,
    resolve(componentName) {
      const from = componentMap[componentName]
      if (!from) {
        return undefined
      }
      return {
        name: componentName,
        from,
        resolvedId: from,
        sourceType: 'wevu-sfc',
        typeImport: false,
      }
    },
    resolveExternalMetadataCandidates(from) {
      if (!from.startsWith(`${PACKAGE_NAME}/components/`)) {
        return undefined
      }
      const relative = from.slice(`${PACKAGE_NAME}/`.length).replace(/\.vue$/, '')
      const componentDir = relative.split('/')[1]
      return {
        packageName: PACKAGE_NAME,
        dts: [
          `${relative}.d.ts`,
          `components/${componentDir}/types.d.ts`,
          `components/${componentDir}/type.d.ts`,
          'global.d.ts',
        ],
        js: [],
      }
    },
  }
}
