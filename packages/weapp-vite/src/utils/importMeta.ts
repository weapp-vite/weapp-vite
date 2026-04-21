import path from 'pathe'
import { normalizeRelativePath } from './path'

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

export function resolveImportMetaEnvObject(defineImportMetaEnv?: Record<string, any>) {
  const rawEnv = defineImportMetaEnv?.['import.meta.env']
  const parsed = parseImportMetaDefineValue(rawEnv)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  return parsed
}

export function resolveImportMetaEnvMemberValues(defineImportMetaEnv?: Record<string, any>) {
  const values = {
    ...resolveImportMetaEnvObject(defineImportMetaEnv),
  }

  for (const [key, value] of Object.entries(defineImportMetaEnv ?? {})) {
    if (key === 'import.meta.env' || !key.startsWith('import.meta.env.')) {
      continue
    }
    values[key.slice('import.meta.env.'.length)] = parseImportMetaDefineValue(value)
  }

  return values
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
    envAccess: resolveImportMetaEnvMemberValues(options.defineImportMetaEnv),
  }
}

export function createStaticImportMetaReplacementMap(options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}) {
  const values = createStaticImportMetaValues(options)
  const envJson = typeof options.defineImportMetaEnv?.['import.meta.env'] === 'string'
    ? options.defineImportMetaEnv['import.meta.env']
    : JSON.stringify(values.env)

  return {
    ...(options.defineImportMetaEnv ?? {}),
    'import.meta.filename': JSON.stringify(values.filename),
    'import.meta.url': JSON.stringify(values.url),
    'import.meta.dirname': JSON.stringify(values.dirname),
    'import.meta': `{"filename":${JSON.stringify(values.filename)},"url":${JSON.stringify(values.url)},"dirname":${JSON.stringify(values.dirname)},"env":${envJson}}`,
  }
}
