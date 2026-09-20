import type { StaticRouteValue } from 'wevu/compiler'
import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'
import type { NamedAutoRoute } from '../types'
import { WEVU_ROUTER_MODULE_ID } from '@weapp-core/constants'

const INDENT = '    '
const TS_STRING_PLACEHOLDER = '${' + 'string}'
const TS_PATH_PLACEHOLDER = '${' + 'Path}'

function formatTuple(values: string[], baseIndent = '') {
  if (values.length === 0) {
    return '[]'
  }

  const indent = `${baseIndent}${INDENT}`
  const lines = values.map(value => `${indent}${JSON.stringify(value)}`)
  return `[\n${lines.join(',\n')}\n${baseIndent}]`
}

function formatSubPackagesTuple(subPackages: AutoRoutesSubPackage[], baseIndent = '') {
  if (subPackages.length === 0) {
    return '[]'
  }

  const lines: string[] = ['[']
  const objectIndent = `${baseIndent}${INDENT}`
  const fieldIndent = `${objectIndent}${INDENT}`

  subPackages.forEach((pkg, index) => {
    lines.push(`${objectIndent}{`)
    lines.push(`${fieldIndent}root: ${JSON.stringify(pkg.root)};`)
    const pages = formatTuple(pkg.pages, fieldIndent)
    lines.push(`${fieldIndent}pages: ${pages};`)
    lines.push(`${fieldIndent}[k: string]: unknown;`)
    lines.push(`${objectIndent}}${index < subPackages.length - 1 ? ',' : ''}`)
  })

  lines.push(`${baseIndent}]`)
  return lines.join('\n')
}

function formatStaticRouteType(value: StaticRouteValue, baseIndent: string): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return 'string'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'unknown[]'
    }
    const memberTypes = [...new Set(value.map(item => formatStaticRouteType(item, baseIndent)))]
    return `Array<${memberTypes.join(' | ')}>`
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    return '{}'
  }
  const propertyIndent = `${baseIndent}${INDENT}`
  const lines = entries.map(([key, propertyValue]) => {
    return `${propertyIndent}${JSON.stringify(key)}: ${formatStaticRouteType(propertyValue, propertyIndent)};`
  })
  return `{\n${lines.join('\n')}\n${baseIndent}}`
}

function formatNamedRouteMapEntries(routes: NamedAutoRoute[]) {
  const routeIndent = `${INDENT}${INDENT}`
  const fieldIndent = `${routeIndent}${INDENT}`
  return routes.map((route) => {
    return [
      `${routeIndent}${JSON.stringify(route.name)}: {`,
      `${fieldIndent}path: ${JSON.stringify(route.path)};`,
      `${fieldIndent}meta: ${formatStaticRouteType(route.meta, fieldIndent)};`,
      `${routeIndent}};`,
    ].join('\n')
  })
}

export function createTypedRouterDefinition(routes: AutoRoutes, namedRoutes: NamedAutoRoute[] = []) {
  const pagesType = formatTuple(routes.pages, INDENT)
  const entriesType = formatTuple(routes.entries, INDENT)
  const subPackagesType = formatSubPackagesTuple(routes.subPackages, INDENT)
  const namedRouteMapEntries = formatNamedRouteMapEntries(namedRoutes)

  return [
    '/* eslint-disable */',
    '// biome-ignore lint: disable',
    '// oxlint-disable',
    '// ------',
    '// 由 weapp-vite 自动生成，请勿编辑。',
    `import '${WEVU_ROUTER_MODULE_ID}';`,
    '',
    'declare module \'weapp-vite/auto-routes\' {',
    `    export type AutoRoutesPages = ${pagesType};`,
    `    export type AutoRoutesEntries = ${entriesType};`,
    `    export type AutoRoutesSubPackages = ${subPackagesType};`,
    '    export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];',
    '    export interface AutoRoutes {',
    '        readonly pages: AutoRoutesPages;',
    '        readonly entries: AutoRoutesEntries;',
    '        readonly subPackages: AutoRoutesSubPackages;',
    '    }',
    '    export type AutoRouteEntry = AutoRoutesEntries[number];',
    `    export type AutoRoutesRelativeUrl = \`./${TS_STRING_PLACEHOLDER}\` | \`../${TS_STRING_PLACEHOLDER}\`;`,
    `    export type AutoRoutesAbsoluteUrl<Path extends string> = Path | \`/${TS_PATH_PLACEHOLDER}\` | \`${TS_PATH_PLACEHOLDER}?${TS_STRING_PLACEHOLDER}\` | \`/${TS_PATH_PLACEHOLDER}?${TS_STRING_PLACEHOLDER}\`;`,
    '    export type AutoRoutesUrl = AutoRoutesAbsoluteUrl<AutoRouteEntry> | AutoRoutesRelativeUrl;',
    '    export type AutoRouteNavigateOption = {',
    '        readonly url: AutoRoutesUrl;',
    '    } & Record<string, any>;',
    '    export interface AutoRoutesMiniProgramRouter {',
    '        switchTab: (option: AutoRouteNavigateOption) => unknown;',
    '        reLaunch: (option: AutoRouteNavigateOption) => unknown;',
    '        redirectTo: (option: AutoRouteNavigateOption) => unknown;',
    '        navigateTo: (option: AutoRouteNavigateOption) => unknown;',
    '        navigateBack: (option?: Record<string, any>) => unknown;',
    '    }',
    '    export type AutoRoutesWxRouter = AutoRoutesMiniProgramRouter;',
    '    export const routes: AutoRoutes;',
    '    export const pages: AutoRoutesPages;',
    '    export const entries: AutoRoutesEntries;',
    '    export const subPackages: AutoRoutesSubPackages;',
    '    export const miniProgramRouter: AutoRoutesMiniProgramRouter;',
    '    export const wxRouter: AutoRoutesWxRouter;',
    '    export default routes;',
    '}',
    '',
    `declare module '${WEVU_ROUTER_MODULE_ID}' {`,
    '    interface WevuTypedRouterRouteMap {',
    '        entries: import(\'weapp-vite/auto-routes\').AutoRoutesEntries[number];',
    '    }',
    '    interface WevuNamedRouteMap {',
    ...namedRouteMapEntries,
    '    }',
    '}',
    '',
  ].join('\n')
}
