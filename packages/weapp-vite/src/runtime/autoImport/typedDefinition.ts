import type { ComponentPropMap } from '../componentProps'
import type { ComponentMetadata } from './metadata'
import { formatPropertyKey } from './definitionFormat'

function formatComponentEntry(name: string, props?: ComponentPropMap) {
  const indent = '    '
  const key = formatPropertyKey(name)

  if (!props || props.size === 0) {
    return `${indent}${key}: Record<string, any>;`
  }

  const lines: string[] = [`${indent}${key}: {`]
  const innerIndent = `${indent}  `
  const entries = Array.from(props.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  for (const [propName, type] of entries) {
    const formattedProp = formatPropertyKey(propName)
    lines.push(`${innerIndent}readonly ${formattedProp}?: ${type};`)
  }
  lines.push(`${indent}};`)
  return lines.join('\n')
}

export function createTypedComponentsDefinition(
  componentNames: string[],
  getMetadata: (name: string) => ComponentMetadata,
) {
  const lines: string[] = [
    '/* eslint-disable */',
    '// @ts-nocheck',
    '// biome-ignore lint: disable',
    '// oxlint-disable',
    '// ------',
    '// 由 weapp-vite 自动生成，请勿编辑。',
    'declare module \'weapp-vite/typed-components\' {',
    '  export interface ComponentProps {',
  ]

  if (componentNames.length === 0) {
    lines.push('    [component: string]: Record<string, any>;')
  }
  else {
    for (const name of componentNames) {
      const metadata = getMetadata(name)
      lines.push(formatComponentEntry(name, metadata.types))
    }
  }

  lines.push('  }')
  lines.push('  export type ComponentPropName = keyof ComponentProps;')
  lines.push('  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : Record<string, any>;')
  lines.push('  export const componentProps: ComponentProps;')
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}
