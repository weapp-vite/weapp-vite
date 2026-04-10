import type { JsxImportedComponent } from './types'
import * as t from '@babel/types'

export function mayContainJsxAutoComponentEntry(source: string) {
  return source.includes('import') || source.includes('export default')
}

export function defaultIsDefineComponentSource(source: string) {
  return source === 'vue'
}

export function getJsxImportedName(imported: any) {
  return t.isIdentifier(imported)
    ? imported.name
    : t.isStringLiteral(imported)
      ? imported.value
      : imported?.type === 'Identifier'
        ? imported.name
        : imported?.type === 'StringLiteral'
          ? imported.value
          : undefined
}

export function createJsxImportedComponent(
  localName: string,
  importSource: string,
  kind: JsxImportedComponent['kind'],
  imported?: any,
): JsxImportedComponent {
  return {
    localName,
    importSource,
    importedName: kind === 'default' ? 'default' : getJsxImportedName(imported),
    kind,
  }
}

export function getJsxImportLocalName(specifier: any) {
  if ('local' in (specifier ?? {}) && t.isIdentifier(specifier.local)) {
    return specifier.local.name
  }
  return specifier?.local?.type === 'Identifier'
    ? specifier.local.name
    : undefined
}

export function isJsxDefineComponentImportSpecifier(specifier: any) {
  return t.isImportSpecifier(specifier)
    ? t.isIdentifier(specifier.imported, { name: 'defineComponent' })
    : specifier?.type === 'ImportSpecifier'
      && specifier.imported?.type === 'Identifier'
      && specifier.imported.name === 'defineComponent'
}
