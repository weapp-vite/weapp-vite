import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { normalizeRelativePath } from './path'

export interface StaticImportMetaValues {
  dirname: string
  env: Record<string, any>
  url: string
}

export function resolveImportMetaEnvObject(defineImportMetaEnv?: Record<string, any>) {
  const rawEnv = defineImportMetaEnv?.['import.meta.env']
  if (typeof rawEnv !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(rawEnv)
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

export function createStaticImportMetaValues(options: {
  defineImportMetaEnv?: Record<string, any>
  extension: string
  relativePath: string
}): StaticImportMetaValues {
  const normalizedRelativePath = normalizeRelativePath(removeExtensionDeep(options.relativePath))
  const normalizedExtension = options.extension.startsWith('.')
    ? options.extension.slice(1)
    : options.extension
  const url = `/${normalizedRelativePath}${normalizedExtension ? `.${normalizedExtension}` : ''}`
  const dirname = normalizeRelativePath(path.dirname(url)) || '/'

  return {
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
  const envJson = typeof options.defineImportMetaEnv?.['import.meta.env'] === 'string'
    ? options.defineImportMetaEnv['import.meta.env']
    : JSON.stringify(values.env)

  return {
    ...(options.defineImportMetaEnv ?? {}),
    'import.meta.url': JSON.stringify(values.url),
    'import.meta.dirname': JSON.stringify(values.dirname),
    'import.meta': `{"url":${JSON.stringify(values.url)},"dirname":${JSON.stringify(values.dirname)},"env":${envJson}}`,
  }
}
