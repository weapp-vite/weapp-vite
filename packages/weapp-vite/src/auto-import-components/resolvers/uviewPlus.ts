import type { ResolverObject, ResolverSupportFilesStrategy } from './types'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import components from './json/uviewPlus.json'

export interface UviewPlusResolverOptions {
  supportFilesStrategy?: ResolverSupportFilesStrategy
}

const PACKAGE_NAME = 'uview-plus'
const require = createRequire(import.meta.url)

function resolveComponentId(from: string, importerBaseName: string) {
  const paths = importerBaseName
    ? [path.dirname(importerBaseName), process.cwd()]
    : [process.cwd()]
  try {
    return require.resolve(from, { paths })
  }
  catch {
    return undefined
  }
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase())
}

/**
 * 创建 uview-plus 的 Vue SFC 自动导入解析器。
 */
export function UviewPlusResolver(options: UviewPlusResolverOptions = {}): ResolverObject {
  const componentMap = Object.fromEntries(components.flatMap((componentName) => {
    const suffix = componentName.slice('u-'.length)
    const from = `${PACKAGE_NAME}/components/${componentName}/${componentName}.vue`
    return [
      [componentName, from],
      [`up-${suffix}`, from],
    ]
  }))

  return {
    components: Object.freeze(componentMap),
    supportFilesStrategy: options.supportFilesStrategy ?? 'used',
    resolve(componentName, importerBaseName) {
      const from = componentMap[componentName]
      if (!from) {
        return undefined
      }
      return {
        name: componentName,
        from,
        resolvedId: resolveComponentId(from, importerBaseName),
        sourceType: 'wevu-sfc',
        typeImport: false,
      }
    },
    resolveExternalMetadataCandidates(from) {
      if (!from.startsWith(`${PACKAGE_NAME}/components/`)) {
        return undefined
      }
      const componentName = from.slice(`${PACKAGE_NAME}/components/`.length).split('/')[0]
      if (!components.includes(componentName as typeof components[number])) {
        return undefined
      }
      const suffix = componentName.slice('u-'.length)
      const camelName = toCamelCase(suffix)
      const componentConfigFiles = [
        `components/${componentName}/${camelName}.js`,
        `components/${componentName}/${suffix.replaceAll('-', '')}.js`,
      ].filter((candidate, index, all) => all.indexOf(candidate) === index)
      return {
        packageName: PACKAGE_NAME,
        dts: [
          `types/comps/${camelName}.d.ts`,
          'types/comps.d.ts',
          'types/index.d.ts',
        ],
        js: [
          `components/${componentName}/props.js`,
          ...componentConfigFiles,
        ],
      }
    },
  }
}
