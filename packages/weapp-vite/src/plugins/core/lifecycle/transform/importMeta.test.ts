import { WEAPP_VITE_IMPORT_META_ENV_KEY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { createImportMetaDefineRegistry } from '../../../../utils/importMeta'
import { replaceImportMetaAccess } from './importMeta'

function createCachedEnvLinePattern(prefix: string) {
  return new RegExp(
    `${prefix}.*globalThis\\["${WEAPP_VITE_IMPORT_META_ENV_KEY}"\\].*JSON\\.parse\\(`,
  )
}

describe('importMeta transform helpers', () => {
  it('prefers explicit import.meta.env member defines without mutating bare import.meta.env object', () => {
    const code = replaceImportMetaAccess(
      'export const envObject = import.meta.env; export const flag = import.meta.env.ISSUE_484_FLAG',
      {
        importMetaDefineRegistry: createImportMetaDefineRegistry({
          defineEntries: {
            'import.meta.env': '{"MODE":"production"}',
            'import.meta.env.ISSUE_484_FLAG': '123456',
          },
        }),
        extension: 'js',
        relativePath: 'pages/import-meta/index.js',
      },
    )

    expect(code).toMatch(createCachedEnvLinePattern('export const envObject = '))
    expect(code).toContain('flag = 123456')
    expect(code).not.toContain('ISSUE_484_FLAG')
    expect(code).not.toContain('import.meta.env')
  })
})
