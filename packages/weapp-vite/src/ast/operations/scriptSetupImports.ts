import type { AstEngineName } from '../types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../utils/babel'
import { parseJsLikeWithEngine } from '../engine'

export interface ScriptSetupImport {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

function collectWithOxc(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: ScriptSetupImport[] = []
  const ast = parseJsLikeWithEngine(scriptSetup, {
    engine: 'oxc',
    filename: 'inline.ts',
  }) as any

  for (const node of ast.body ?? []) {
    if (node?.type !== 'ImportDeclaration' || node.importKind === 'type') {
      continue
    }

    const importSource = node.source?.value
    if (typeof importSource !== 'string') {
      continue
    }

    for (const specifier of node.specifiers ?? []) {
      if (specifier?.importKind === 'type' || specifier?.local?.type !== 'Identifier') {
        continue
      }
      const localName = specifier.local.name
      if (!templateComponentNames.has(localName)) {
        continue
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        results.push({ localName, importSource, importedName: 'default', kind: 'default' })
      }
      else if (specifier.type === 'ImportSpecifier') {
        const importedName = specifier.imported?.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported?.type === 'StringLiteral'
            ? specifier.imported.value
            : undefined
        results.push({ localName, importSource, importedName, kind: 'named' })
      }
    }
  }

  return results
}

function collectWithBabel(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: ScriptSetupImport[] = []
  const ast = babelParse(scriptSetup, BABEL_TS_MODULE_PARSER_OPTIONS)

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue
    }
    // @ts-ignore - Babel AST 结构
    const importKind = (node as any).importKind
    if (importKind === 'type') {
      continue
    }

    const importSource = node.source.value
    for (const specifier of node.specifiers) {
      // @ts-ignore - Babel AST 结构
      if ((specifier as any).importKind === 'type') {
        continue
      }
      const localName = specifier.local?.name
      if (!localName || !templateComponentNames.has(localName)) {
        continue
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        results.push({ localName, importSource, importedName: 'default', kind: 'default' })
      }
      else if (specifier.type === 'ImportSpecifier') {
        const imported = (specifier as any).imported
        const importedName = imported?.type === 'Identifier'
          ? imported.name
          : imported?.type === 'StringLiteral'
            ? imported.value
            : undefined
        results.push({ localName, importSource, importedName, kind: 'named' })
      }
    }
  }

  return results
}

/**
 * 收集 `<script setup>` 中会参与自动 usingComponents 的导入声明。
 */
export function collectScriptSetupImportsFromCode(
  scriptSetup: string,
  templateComponentNames: Set<string>,
  options?: {
    astEngine?: AstEngineName
  },
) {
  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc'
      ? collectWithOxc(scriptSetup, templateComponentNames)
      : collectWithBabel(scriptSetup, templateComponentNames)
  }
  catch {
    return []
  }
}
