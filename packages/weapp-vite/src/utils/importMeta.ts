import path from 'pathe'
import { normalizeRelativePath } from './path'

const IMPORT_META_ENV_PREFIX = 'import.meta.env.'

export interface ImportMetaDefineRegistry {
  defineEntries: Record<string, any>
  envObject: Record<string, any>
  envMemberAccess: Record<string, any>
}

export interface StaticImportMetaValues {
  filename: string
  dirname: string
  env: Record<string, any>
  envAccess: Record<string, any>
  url: string
}

export function parseImportMetaDefineValue(value: any) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

export function pickImportMetaEnvDefineEntries(define?: Record<string, any>) {
  if (!define) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(define).filter(([key]) => {
      return key === 'import.meta.env' || key.startsWith(IMPORT_META_ENV_PREFIX)
    }),
  )
}

export function resolveImportMetaEnvObject(defineImportMetaEnv?: Record<string, any>, fallbackEnv: Record<string, any> = {}) {
  const rawEnv = defineImportMetaEnv?.['import.meta.env']
  const parsed = parseImportMetaDefineValue(rawEnv)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fallbackEnv
  }

  return parsed
}

export function resolveImportMetaEnvMemberValues(defineImportMetaEnv?: Record<string, any>, fallbackEnv: Record<string, any> = {}) {
  const values = {
    ...resolveImportMetaEnvObject(defineImportMetaEnv, fallbackEnv),
  }

  for (const [key, value] of Object.entries(defineImportMetaEnv ?? {})) {
    if (key === 'import.meta.env' || !key.startsWith(IMPORT_META_ENV_PREFIX)) {
      continue
    }
    values[key.slice(IMPORT_META_ENV_PREFIX.length)] = parseImportMetaDefineValue(value)
  }

  return values
}

export function createImportMetaDefineRegistry(options?: {
  baseEnv?: Record<string, any>
  defineEntries?: Record<string, any>
}): ImportMetaDefineRegistry {
  const baseEnv = {
    ...(options?.baseEnv ?? {}),
  }
  const explicitDefineEntries = pickImportMetaEnvDefineEntries(options?.defineEntries)
  const defaultDefineEntries: Record<string, any> = {}

  for (const [key, value] of Object.entries(baseEnv)) {
    defaultDefineEntries[`${IMPORT_META_ENV_PREFIX}${key}`] = JSON.stringify(value)
  }
  defaultDefineEntries['import.meta.env'] = JSON.stringify(baseEnv)

  const defineEntries = {
    ...defaultDefineEntries,
    ...explicitDefineEntries,
  }

  return {
    defineEntries,
    envObject: resolveImportMetaEnvObject(defineEntries, baseEnv),
    envMemberAccess: resolveImportMetaEnvMemberValues(defineEntries, baseEnv),
  }
}

export function createStaticImportMetaValues(options: {
  importMetaDefineRegistry?: ImportMetaDefineRegistry
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
    env: options.importMetaDefineRegistry?.envObject ?? {},
    envAccess: options.importMetaDefineRegistry?.envMemberAccess ?? {},
  }
}

export function createStaticImportMetaReplacementMap(options: {
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  extension: string
  relativePath: string
}) {
  const values = createStaticImportMetaValues(options)
  const defineEntries = options.importMetaDefineRegistry?.defineEntries ?? {}
  const envJson = typeof defineEntries['import.meta.env'] === 'string'
    ? defineEntries['import.meta.env']
    : JSON.stringify(values.env)

  return {
    ...defineEntries,
    'import.meta.filename': JSON.stringify(values.filename),
    'import.meta.url': JSON.stringify(values.url),
    'import.meta.dirname': JSON.stringify(values.dirname),
    'import.meta': `{"filename":${JSON.stringify(values.filename)},"url":${JSON.stringify(values.url)},"dirname":${JSON.stringify(values.dirname)},"env":${envJson}}`,
  }
}
