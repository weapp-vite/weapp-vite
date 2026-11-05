import { describe, expect, it } from 'vitest'
import { parseRegressionOptions } from './regressionOptions'

const required = ['--baseline-entry', 'baseline/index.mjs', '--current-entry', 'current/index.mjs', '--baseline-source', 'baseline', '--baseline-identity', 'baseline-identity.json']

describe('regression CLI diagnostic boundaries', () => {
  it('defaults to both runtimes, complete budget and fail-fast without forcing filtered core research', () => {
    expect(parseRegressionOptions(required)).toMatchObject({ runtime: 'both', rounds: 40, warmup: 10, check: false, keepGoing: false, groups: undefined, operations: undefined, coreProfile: undefined })
  })

  it('supports repeated operation lists and explicit diagnostic research', () => {
    expect(parseRegressionOptions([...required, '--runtime', 'node', '--operations', 'scan,parse', '--operations', 'canonical', '--group', 'shared', '--rounds', '3', '--warmup', '0', '--keep-going', '--core-profile'])).toMatchObject({ runtime: 'node', rounds: 3, warmup: 0, operations: ['scan', 'parse', 'canonical'], groups: ['shared'], keepGoing: true, coreProfile: true })
  })

  it('selects three real representative groups and five core operations for quick diagnosis', () => {
    expect(parseRegressionOptions([...required, '--quick'])).toMatchObject({ quick: true, check: false, rounds: 5, warmup: 2, groups: ['old464/shared', 'all-platform/shared-xml/all', 'all-platform/platform-specific/all'], operations: ['scan', 'parse', 'canonical', 'parse-edit-serialize', 'preserve-noop'], coreProfile: false })
    expect(parseRegressionOptions([...required, '--quick', '--group', 'explicit', '--operations', 'parse', '--rounds', '7', '--warmup', '1', '--core-profile'])).toMatchObject({ groups: ['explicit'], operations: ['parse'], rounds: 7, warmup: 1, coreProfile: true })
  })

  it.each([['--runtime', 'node'], ['--group', 'shared'], ['--operations', 'parse'], ['--keep-going'], ['--quick']])('rejects formal diagnostic exceptions: %j', (...args) => {
    expect(() => parseRegressionOptions([...required, '--check', ...args])).toThrow('Formal regression check requires')
  })

  it.each([['--runtime', 'unknown'], ['--rounds', '0'], ['--rounds', '1.5'], ['--warmup', '-1']])('rejects invalid execution budgets: %j', (...args) => {
    expect(() => parseRegressionOptions([...required, ...args])).toThrow()
  })
})
