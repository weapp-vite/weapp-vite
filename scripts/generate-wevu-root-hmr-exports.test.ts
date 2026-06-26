import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WEVU_ROOT_HMR_EXPORTS } from '../e2e/generated/wevu-root-hmr-exports'
import {
  collectWevuRootValueExports,
  quoteSingleStringLiteral,
  renderWevuRootHmrExports,
} from './generate-wevu-root-hmr-exports'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const GENERATED_PATH = path.join(REPO_ROOT, 'e2e/generated/wevu-root-hmr-exports.ts')

describe('wevu root HMR export manifest', () => {
  it('stays in sync with root wevu value exports', () => {
    expect(WEVU_ROOT_HMR_EXPORTS).toEqual(collectWevuRootValueExports())
  })

  it('keeps the generated file stable', () => {
    expect(fs.readFileSync(GENERATED_PATH, 'utf8')).toBe(renderWevuRootHmrExports([...WEVU_ROOT_HMR_EXPORTS]))
  })

  it('renders single quoted string literals deterministically', () => {
    expect(renderWevuRootHmrExports(['plain', 'quote\'name', 'slash\\name'])).toContain(
      [
        '  \'plain\',',
        '  \'quote\\\'name\',',
        '  \'slash\\\\name\',',
      ].join('\n'),
    )
    expect(quoteSingleStringLiteral('quote\'name')).toBe('\'quote\\\'name\'')
  })

  it('guards the runtime APIs that previously failed after HMR', () => {
    expect(WEVU_ROOT_HMR_EXPORTS).toContain('onShareAppMessage')
    expect(WEVU_ROOT_HMR_EXPORTS).toContain('unref')
  })
})
