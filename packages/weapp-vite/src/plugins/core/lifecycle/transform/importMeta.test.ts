import { describe, expect, it } from 'vitest'
import { replaceImportMetaAccess } from './importMeta'

describe('importMeta transform helpers', () => {
  it('prefers explicit import.meta.env member defines without mutating bare import.meta.env object', () => {
    const code = replaceImportMetaAccess(
      'export const envObject = import.meta.env; export const flag = import.meta.env.ISSUE_484_FLAG',
      {
        defineImportMetaEnv: {
          'import.meta.env': '{"MODE":"production"}',
          'import.meta.env.ISSUE_484_FLAG': '123456',
        },
        extension: 'js',
        relativePath: 'pages/import-meta/index.js',
      },
    )

    expect(code).toContain('export const envObject = {')
    expect(code).toContain('MODE: "production"')
    expect(code).toContain('flag = 123456')
    expect(code).not.toContain('ISSUE_484_FLAG')
    expect(code).not.toContain('import.meta.env')
  })
})
