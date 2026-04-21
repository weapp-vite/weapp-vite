import path from 'pathe'
import { normalizeRelativePath } from './path'

export interface StaticImportMetaValues {
  filename: string
  dirname: string
  env: Record<string, any>
  url: string
}

function tryParseImportMetaEnvObject(rawEnv: string) {
  try {
    const parsed = JSON.parse(rawEnv)
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

function extractImportMetaEnvJson(rawEnv: string) {
  const normalized = rawEnv.trim()
  const matched = normalized.match(/^JSON\.parse\((.+)\)$/s)
  if (!matched) {
    return normalized
  }

  try {
    const parsed = JSON.parse(matched[1]!)
    return typeof parsed === 'string' ? parsed : normalized
  }
  catch {
    return normalized
  }
}

export function resolveImportMetaEnvObject(defineImportMetaEnv?: Record<string, any>) {
  const rawEnv = defineImportMetaEnv?.['import.meta.env']
  if (typeof rawEnv !== 'string') {
    return {}
  }

  return tryParseImportMetaEnvObject(extractImportMetaEnvJson(rawEnv))
}

export function resolveImportMetaEnvExpression(defineImportMetaEnv?: Record<string, any>) {
  const rawEnv = defineImportMetaEnv?.['import.meta.env']
  return typeof rawEnv === 'string' && rawEnv.trim()
    ? rawEnv
    : JSON.stringify(resolveImportMetaEnvObject(defineImportMetaEnv))
}

export function createStaticImportMetaValues(options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}): StaticImportMetaValues {
  const normalizedRelativePath = normalizeRelativePath(
    path.extname(options.relativePath)
      ? options.relativePath.slice(0, -path.extname(options.relativePath).length)
      : options.relativePath,
  )
  const normalizedExtension = options.extension.startsWith('.')
    ? options.extension.slice(1)
    : options.extension
  const url = `/${normalizedRelativePath}${normalizedExtension ? `.${normalizedExtension}` : ''}`
  const dirname = normalizeRelativePath(path.dirname(url)) || '/'

  return {
    filename: url,
    url,
    dirname: dirname === '.' ? '/' : dirname,
    env: resolveImportMetaEnvObject(options.defineImportMetaEnv),
  }
}

export function createStaticImportMetaReplacementMap(options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}) {
  const values = createStaticImportMetaValues(options)
  const envJson = resolveImportMetaEnvExpression(options.defineImportMetaEnv)

  return {
    ...(options.defineImportMetaEnv ?? {}),
    'import.meta.filename': JSON.stringify(values.filename),
    'import.meta.url': JSON.stringify(values.url),
    'import.meta.dirname': JSON.stringify(values.dirname),
    'import.meta': `{"filename":${JSON.stringify(values.filename)},"url":${JSON.stringify(values.url)},"dirname":${JSON.stringify(values.dirname)},"env":${envJson}}`,
  }
}
