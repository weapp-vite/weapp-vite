import path from 'pathe'
import { toPosixPath } from '../../../../../utils'
import { normalizeNpmImportLookupPath } from '../../../../../utils/npmImport'
import {
  DIRECTIVE_PROLOGUE_RE,
} from '../constants'

export function normalizeWeappLocalNpmImport(importee: string) {
  const normalized = normalizeNpmImportLookupPath(importee)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 1 || (segments.length === 2 && normalized.startsWith('@'))) {
    return `${normalized}/index`
  }
  return normalized
}

export function getRequireImportLiteral(node: any) {
  if (!node) {
    return null
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : null
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    return node.quasis[0]?.value?.cooked ?? null
  }

  return null
}

export function getStaticStringLiteral(node: any) {
  return getRequireImportLiteral(node)
}

export function setRequireImportLiteral(node: any, nextValue: string) {
  if (!node) {
    return
  }

  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    node.value = nextValue
    return
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    node.quasis[0].value.raw = nextValue
    node.quasis[0].value.cooked = nextValue
  }
}

export function normalizeRelativeChunkImport(fileName: string, importee: string) {
  return toPosixPath(path.normalize(path.join(path.dirname(fileName), importee)))
}

export function prependChunkCodePreservingDirectives(code: string, injectedCode: string) {
  const directiveMatch = code.match(DIRECTIVE_PROLOGUE_RE)
  if (!directiveMatch?.[0]) {
    return `${injectedCode}\n${code}`
  }

  const directivePrologue = directiveMatch[0]
  return `${directivePrologue}${injectedCode}\n${code.slice(directivePrologue.length)}`
}
