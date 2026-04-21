import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'pathe'
import { toPosixPath } from '../../../../../utils'
import { normalizeNpmImportLookupPath, parseNpmPackageSpecifier } from '../../../../../utils/npmImport'
import {
  DIRECTIVE_PROLOGUE_RE,
} from '../constants'

const SCRIPT_ENTRY_CANDIDATES = ['index.js', 'index.mjs', 'index.cjs'] as const
const SCRIPT_FILE_EXTENSIONS = ['.js', '.mjs', '.cjs'] as const
const SCRIPT_FILE_RE = /\.[cm]?js$/i
const resolvePackageJson = createRequire(import.meta.url)

function resolveInstalledPackageEntryRoot(importee: string, basedir?: string) {
  const parsed = parseNpmPackageSpecifier(importee)
  if (!parsed) {
    return undefined
  }

  try {
    const packageJsonPath = resolvePackageJson.resolve(`${parsed.packageName}/package.json`, {
      paths: basedir ? [basedir] : undefined,
    })
    const packageRoot = path.dirname(packageJsonPath)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      miniprogram?: string
    }
    const miniprogramRoot = typeof packageJson.miniprogram === 'string' && packageJson.miniprogram
      ? packageJson.miniprogram
      : undefined

    return {
      ...parsed,
      entryRoot: miniprogramRoot ? path.resolve(packageRoot, miniprogramRoot) : packageRoot,
    }
  }
  catch {
    return undefined
  }
}

export function normalizeWeappLocalNpmImport(importee: string, basedir?: string) {
  const normalized = normalizeNpmImportLookupPath(importee)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 1 || (segments.length === 2 && normalized.startsWith('@'))) {
    return `${normalized}/index`
  }

  if (SCRIPT_FILE_RE.test(normalized)) {
    return normalized
  }

  const resolved = resolveInstalledPackageEntryRoot(normalized, basedir)
  if (!resolved?.subPath) {
    return normalized
  }

  const targetPath = path.resolve(resolved.entryRoot, resolved.subPath)
  if (SCRIPT_FILE_EXTENSIONS.some(ext => existsSync(`${targetPath}${ext}`))) {
    return normalized
  }
  if (SCRIPT_ENTRY_CANDIDATES.some(candidate => existsSync(path.resolve(targetPath, candidate)))) {
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
