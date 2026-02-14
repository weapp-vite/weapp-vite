import type { AutoRoutes, AutoRoutesSubPackage } from '../../../types/routes'

function formatTuple(values: string[], baseIndent = '') {
  if (values.length === 0) {
    return '[]'
  }

  const indent = `${baseIndent}  `
  const lines = values.map(value => `${indent}${JSON.stringify(value)}`)
  return `[\n${lines.join(',\n')}\n${baseIndent}]`
}

function formatSubPackagesTuple(subPackages: AutoRoutesSubPackage[]) {
  if (subPackages.length === 0) {
    return '[]'
  }

  const lines: string[] = ['[']

  subPackages.forEach((pkg, index) => {
    lines.push('  {')
    lines.push(`    readonly root: ${JSON.stringify(pkg.root)};`)
    const pages = formatTuple(pkg.pages, '    ')
    lines.push(`    readonly pages: ${pages};`)
    lines.push(`  }${index < subPackages.length - 1 ? ',' : ''}`)
  })

  lines.push(']')
  return lines.join('\n')
}

export function createTypedRouterDefinition(routes: AutoRoutes) {
  const pagesType = formatTuple(routes.pages)
  const entriesType = formatTuple(routes.entries)
  const subPackagesType = formatSubPackagesTuple(routes.subPackages)

  return [
    '// 由 weapp-vite 自动生成，请勿编辑。',
    'declare module \'weapp-vite/auto-routes\' {',
    `  export type AutoRoutesPages = ${pagesType};`,
    `  export type AutoRoutesEntries = ${entriesType};`,
    `  export type AutoRoutesSubPackages = ${subPackagesType};`,
    '  export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];',
    '  export interface AutoRoutes {',
    '    readonly pages: AutoRoutesPages;',
    '    readonly entries: AutoRoutesEntries;',
    '    readonly subPackages: AutoRoutesSubPackages;',
    '  }',
    '  export const routes: AutoRoutes;',
    '  export const pages: AutoRoutesPages;',
    '  export const entries: AutoRoutesEntries;',
    '  export const subPackages: AutoRoutesSubPackages;',
    '  export default routes;',
    '}',
    '',
  ].join('\n')
}
