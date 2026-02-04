import type { ComponentPropMap } from '../componentProps'
import type { ComponentMetadata } from './metadata'
import { formatPropertyKey, isValidIdentifierName } from './definitionFormat'

function formatPropsType(props?: ComponentPropMap) {
  if (!props || props.size === 0) {
    return 'Record<string, any>'
  }
  const entries = Array.from(props.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  const lines: string[] = ['{']
  for (const [propName, type] of entries) {
    const key = formatPropertyKey(propName)
    lines.push(`  readonly ${key}?: ${type};`)
  }
  lines.push('}')
  return lines.join('\n')
}

export interface VueComponentsDefinitionOptions {
  /**
   * 启用后，`components.d.ts` 会引用 `weapp-vite/typed-components`，
   * 而不是重复生成 props 类型。
   */
  useTypedComponents?: boolean

  /**
   * `declare module 'xxx'` 的模块名。
   * 默认值：`vue`。
   */
  moduleName?: string

  /**
   * 为每个组件提供导入路径，支持编辑器从模板标签跳转到源码
   * （Cmd/Ctrl+Click）。
   */
  resolveComponentImport?: (name: string) => string | undefined
}

function toPascalCase(name: string) {
  if (!name.includes('-')) {
    return undefined
  }
  const segments = name
    .split('-')
    .map(s => s.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return undefined
  }

  const pascal = segments
    .map((segment) => {
      const first = segment[0]
      if (!first) {
        return ''
      }
      return first.toUpperCase() + segment.slice(1)
    })
    .join('')

  return pascal || undefined
}

function formatSourceImportType(importPath: string) {
  const spec = JSON.stringify(importPath)
  return `__WeappComponentImport<typeof import(${spec})>`
}

function formatWeappComponentTypeFromPropsType(propsType: string) {
  if (propsType.includes('\n')) {
    const indented = propsType
      .split('\n')
      .map((line, index) => {
        if (index === 0) {
          return line
        }
        return `      ${line}`
      })
      .join('\n')
    return `WeappComponent<${indented}>`
  }
  return `WeappComponent<${propsType}>`
}

function formatGlobalComponentEntry(
  name: string,
  metadata: ComponentMetadata,
  sourceImport?: string,
) {
  const key = formatPropertyKey(name)
  const propsType = formatPropsType(metadata.types)
  const baseType = formatWeappComponentTypeFromPropsType(propsType)
  const typeWithSource = sourceImport
    ? `${formatSourceImportType(sourceImport)} & ${baseType}`
    : baseType
  return `    ${key}: ${typeWithSource};`
}

function formatGlobalConstEntry(name: string, metadata: ComponentMetadata, sourceImport?: string) {
  if (!isValidIdentifierName(name)) {
    return undefined
  }
  const propsType = formatPropsType(metadata.types)
  const baseType = propsType.includes('\n')
    ? (() => {
        const indented = propsType
          .split('\n')
          .map((line, index) => {
            if (index === 0) {
              return line
            }
            return `    ${line}`
          })
          .join('\n')
        return `WeappComponent<${indented}>`
      })()
    : `WeappComponent<${propsType}>`

  const typeWithSource = sourceImport
    ? `${formatSourceImportType(sourceImport)} & ${baseType}`
    : baseType
  return `  const ${name}: ${typeWithSource}`
}

export function createVueComponentsDefinition(
  componentNames: string[],
  getMetadata: (name: string) => ComponentMetadata,
  options: VueComponentsDefinitionOptions = {},
) {
  const moduleName = options.moduleName?.trim() || 'vue'
  const emittedComponentKeys = new Set<string>()
  const emittedGlobalConstKeys = new Set<string>()
  const globalConstLines: string[] = []
  const lines: string[] = [
    '/* eslint-disable */',
    '// biome-ignore lint: disable',
    '// oxlint-disable',
    '// ------',
    '// 由 weapp-vite autoImportComponents 生成',
    'import type { ComponentOptionsMixin, DefineComponent, PublicProps } from \'wevu\'',
    ...(options.useTypedComponents
      ? [
          'import type { ComponentProp } from \'weapp-vite/typed-components\'',
        ]
      : []),
    '',
    'export {}',
    '',
    'type WeappComponent<Props = Record<string, any>> = new (...args: any[]) => InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Props, {}>>',
    'type __WeappComponentImport<T, Fallback = {}> = 0 extends 1 & T ? Fallback : T',
    '',
    `declare module '${moduleName}' {`,
    '  export interface GlobalComponents {',
  ]

  if (componentNames.length === 0) {
    lines.push('    [component: string]: WeappComponent;')
  }
  else {
    const emitGlobalConst = (keyName: string, sourceName: string) => {
      if (!isValidIdentifierName(keyName)) {
        return
      }
      if (emittedGlobalConstKeys.has(keyName)) {
        return
      }
      emittedGlobalConstKeys.add(keyName)

      if (options.useTypedComponents) {
        const sourceImport = options.resolveComponentImport?.(sourceName)
        const baseType = `WeappComponent<ComponentProp<${JSON.stringify(sourceName)}>>`
        const typeWithSource = sourceImport
          ? `${formatSourceImportType(sourceImport)} & ${baseType}`
          : baseType
        globalConstLines.push(`  const ${keyName}: ${typeWithSource}`)
        return
      }
      const sourceImport = options.resolveComponentImport?.(sourceName)
      const metadata = getMetadata(sourceName)
      globalConstLines.push(formatGlobalConstEntry(keyName, metadata, sourceImport)!)
    }

    const emitGlobalComponent = (keyName: string, sourceName: string) => {
      if (emittedComponentKeys.has(keyName)) {
        return
      }
      emittedComponentKeys.add(keyName)

      const sourceImport = options.resolveComponentImport?.(sourceName)
      if (options.useTypedComponents) {
        const baseType = `WeappComponent<ComponentProp<${JSON.stringify(sourceName)}>>`
        const typeWithSource = sourceImport
          ? `${formatSourceImportType(sourceImport)} & ${baseType}`
          : baseType
        lines.push(`    ${formatPropertyKey(keyName)}: ${typeWithSource};`)
        emitGlobalConst(keyName, sourceName)
        return
      }

      const metadata = getMetadata(sourceName)
      lines.push(formatGlobalComponentEntry(keyName, metadata, sourceImport))
      emitGlobalConst(keyName, sourceName)
    }

    for (const name of componentNames) {
      // kebab-case 组件标签优先生成 PascalCase key，以对齐 Volar 的模板到符号映射。
      // 同时也生成原始 kebab-case key，这样 `<TCellGroup>` 和 `<t-cell-group>` 两种前缀都能补全。
      const pascal = toPascalCase(name)
      if (pascal && isValidIdentifierName(pascal)) {
        emitGlobalComponent(pascal, name)
        emitGlobalComponent(name, name)
        continue
      }

      emitGlobalComponent(name, name)
    }
  }

  lines.push('  }')
  lines.push('}')
  lines.push('')
  lines.push('// 用于 TSX 支持')
  lines.push('declare global {')

  if (globalConstLines.length === 0) {
    lines.push('}')
  }
  else {
    lines.push(...globalConstLines)
    lines.push('}')
  }

  lines.push('')
  return lines.join('\n')
}
