import { describe, expect, it } from 'vitest'
import { finalizeResult } from './finalize'

describe('finalizeResult', () => {
  it('injects default script when script is empty', () => {
    const result: any = {
      script: '   ',
      meta: {},
    }

    finalizeResult(result, {})
    expect(result.script).toContain('createWevuComponent')
  })

  it('writes macro hashes into result meta', () => {
    const result: any = {
      script: 'export default {}',
      meta: {},
    }

    finalizeResult(result, {
      scriptSetupMacroHash: 'json-123',
      defineOptionsHash: 'opt-456',
    })

    expect(result.meta).toEqual({
      jsonMacroHash: 'json-123',
      defineOptionsHash: 'opt-456',
    })
  })
})
