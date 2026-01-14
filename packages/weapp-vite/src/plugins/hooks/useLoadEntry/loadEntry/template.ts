import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../../utils/babel'
import { collectVueTemplateTags, isAutoImportCandidateTag, VUE_COMPONENT_TAG_RE } from '../../../../utils/vueTemplateTags'

export interface ScriptSetupImport {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

export function collectVueTemplateComponentNames(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto usingComponents',
    shouldCollect: tag => VUE_COMPONENT_TAG_RE.test(tag),
  })
}

export function collectVueTemplateAutoImportTags(template: string, filename: string) {
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: 'auto import tags',
    shouldCollect: isAutoImportCandidateTag,
  })
}

export function collectScriptSetupImports(scriptSetup: string, templateComponentNames: Set<string>) {
  const results: ScriptSetupImport[] = []
  const ast = babelParse(scriptSetup, BABEL_TS_MODULE_PARSER_OPTIONS)

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') {
      continue
    }
    // @ts-ignore - babel AST shape
    const importKind = (node as any).importKind
    if (importKind === 'type') {
      continue
    }

    const importSource = node.source.value
    for (const specifier of node.specifiers) {
      // @ts-ignore - babel AST shape
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
