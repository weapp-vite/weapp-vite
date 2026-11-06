import type { AstEngineName } from '../types'
import { parseSync } from 'oxc-parser'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../babel'

export interface ScriptSetupImport {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

export interface ScriptSetupImportAnalysis {
  status: 'complete' | 'failed'
  imports: ScriptSetupImport[]
}

export function mayContainRelevantScriptSetupImports(
  scriptSetup: string,
  templateComponentNames: Set<string>,
) {
  if (templateComponentNames.size === 0) {
    return false
  }
  if (!scriptSetup.includes('import')) {
    return false
  }
  for (const componentName of templateComponentNames) {
    if (scriptSetup.includes(componentName)) {
      return true
    }
  }
  return false
}

export function getScriptSetupImportedName(imported: any) {
  return imported?.type === 'Identifier'
    ? imported.name
    : imported?.type === 'StringLiteral'
      ? imported.value
      : undefined
}

export function createScriptSetupImport(
  localName: string,
  importSource: string,
  kind: ScriptSetupImport['kind'],
  imported?: any,
): ScriptSetupImport {
  return {
    localName,
    importSource,
    importedName: kind === 'default' ? 'default' : getScriptSetupImportedName(imported),
    kind,
  }
}

function analyzeScriptSetupImportsWithOxc(scriptSetup: string, templateComponentNames: Set<string>): ScriptSetupImportAnalysis {
  const results: ScriptSetupImport[] = []
  const parsed = parseSync('inline.ts', scriptSetup)
  if (parsed.errors.length) {
    return { status: 'failed', imports: [] }
  }
  const ast = parsed.program as any

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
        results.push(createScriptSetupImport(localName, importSource, 'default'))
      }
      else if (specifier.type === 'ImportSpecifier') {
        results.push(createScriptSetupImport(localName, importSource, 'named', specifier.imported))
      }
    }
  }

  return { status: 'complete', imports: results }
}

export function collectScriptSetupImportsWithOxc(scriptSetup: string, templateComponentNames: Set<string>) {
  return analyzeScriptSetupImportsWithOxc(scriptSetup, templateComponentNames).imports
}

export function collectScriptSetupImportsWithBabel(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: ScriptSetupImport[] = []
  const ast = babelParse(scriptSetup, BABEL_TS_MODULE_PARSER_OPTIONS)

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue
    }
    const importKind = (node as any).importKind
    if (importKind === 'type') {
      continue
    }

    const importSource = node.source.value
    for (const specifier of node.specifiers) {
      if ((specifier as any).importKind === 'type') {
        continue
      }
      const localName = specifier.local?.name
      if (!localName || !templateComponentNames.has(localName)) {
        continue
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        results.push(createScriptSetupImport(localName, importSource, 'default'))
      }
      else if (specifier.type === 'ImportSpecifier') {
        results.push(createScriptSetupImport(localName, importSource, 'named', (specifier as any).imported))
      }
    }
  }

  return results
}

/**
 * 分析 `<script setup>` 导入，并区分可复用的成功空结果与解析失败。
 */
export function analyzeScriptSetupImportsFromCode(
  scriptSetup: string,
  templateComponentNames: Set<string>,
  options?: {
    astEngine?: AstEngineName
  },
): ScriptSetupImportAnalysis {
  if (!mayContainRelevantScriptSetupImports(scriptSetup, templateComponentNames)) {
    return { status: 'complete', imports: [] }
  }

  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc'
      ? analyzeScriptSetupImportsWithOxc(scriptSetup, templateComponentNames)
      : { status: 'complete', imports: collectScriptSetupImportsWithBabel(scriptSetup, templateComponentNames) }
  }
  catch {
    return { status: 'failed', imports: [] }
  }
}

/** 收集自动 usingComponents 导入，保留失败时返回空数组的兼容契约。 */
export function collectScriptSetupImportsFromCode(
  scriptSetup: string,
  templateComponentNames: Set<string>,
  options?: {
    astEngine?: AstEngineName
  },
) {
  return analyzeScriptSetupImportsFromCode(scriptSetup, templateComponentNames, options).imports
}
