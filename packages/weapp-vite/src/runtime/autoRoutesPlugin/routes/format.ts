import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'

const INDENT = '    '

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
    lines.push(`${fieldIndent}readonly root: ${JSON.stringify(pkg.root)};`)
    const pages = formatTuple(pkg.pages, fieldIndent)
    lines.push(`${fieldIndent}readonly pages: ${pages};`)
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
    '    export const routes: AutoRoutes;',
    '    export const pages: AutoRoutesPages;',
    '    export const entries: AutoRoutesEntries;',
    '    export const subPackages: AutoRoutesSubPackages;',
    '    export default routes;',
    '}',
    '',
  ].join('\n')
}
