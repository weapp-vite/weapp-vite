import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'

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

export function createTypedRouterDefinition(routes: AutoRoutes) {
  const pagesType = formatTuple(routes.pages, INDENT)
  const entriesType = formatTuple(routes.entries, INDENT)
  const subPackagesType = formatSubPackagesTuple(routes.subPackages, INDENT)

  return [
    '/* eslint-disable */',
    '// biome-ignore lint: disable',
    '// oxlint-disable',
    '// ------',
    '// 由 weapp-vite 自动生成，请勿编辑。',
    'import \'wevu/router\';',
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
    '    export interface AutoRoutesWxRouter {',
    '        switchTab: (option: AutoRouteNavigateOption) => unknown;',
    '        reLaunch: (option: AutoRouteNavigateOption) => unknown;',
    '        redirectTo: (option: AutoRouteNavigateOption) => unknown;',
    '        navigateTo: (option: AutoRouteNavigateOption) => unknown;',
    '        navigateBack: (option?: Record<string, any>) => unknown;',
    '    }',
    '    export type AutoRoutesMiniProgramRouter = AutoRoutesWxRouter;',
    '    export const routes: AutoRoutes;',
    '    export const pages: AutoRoutesPages;',
    '    export const entries: AutoRoutesEntries;',
    '    export const subPackages: AutoRoutesSubPackages;',
    '    export const wxRouter: AutoRoutesWxRouter;',
    '    export const miniProgramRouter: AutoRoutesMiniProgramRouter;',
    '    export default routes;',
    '}',
    '',
    'declare module \'wevu/router\' {',
    '    interface WevuTypedRouterRouteMap {',
    '        entries: import(\'weapp-vite/auto-routes\').AutoRoutesEntries[number];',
    '    }',
    '}',
    '',
  ].join('\n')
}
