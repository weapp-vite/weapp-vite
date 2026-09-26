import type { AcceptanceCaseInput } from './types'
import { describe, expect, it } from 'vitest'
import { evaluateRuntimeVersions } from './runtimeVersions'

const observed = { ideVersion: '2.02.2608060', baseLibraryVersion: '3.17.2' }
function caseWith(runtime: unknown, id = 'case-a'): AcceptanceCaseInput {
  return { id, file: 'example.test.ts', name: 'mounted', state: 'passed', acceptance: { fixture: 'example', provider: 'devtools', checkpoints: [], evidence: [], runtime } } as AcceptanceCaseInput
}

describe('strict observed runtime versions', () => {
  it('accepts actual Tool.getInfo versions independently of project configuration', () => {
    expect(evaluateRuntimeVersions([caseWith(observed)], 'devtools', observed)).toEqual([])
  })
  it.each([undefined, {}, { ...observed, ideVersion: null }, { ...observed, baseLibraryVersion: ' ' }])('rejects missing actual runtime metadata (%j)', (runtime) => {
    expect(evaluateRuntimeVersions([caseWith(runtime)], 'devtools', observed)[0]).toContain('Missing observed')
  })
  it('rejects mixed base libraries and misleading environment summaries', () => {
    expect(evaluateRuntimeVersions([caseWith(observed), caseWith({ ...observed, baseLibraryVersion: '3.15.0' }, 'case-b')], 'devtools')).toEqual(['Observed runtime versions differ between cases: case-b'])
    expect(evaluateRuntimeVersions([caseWith(observed)], 'devtools', { ...observed, ideVersion: 'configured-version' })[0]).toContain('do not match report environment')
  })
  it('does not demand host versions from headless evidence or unexecuted cases', () => {
    expect(evaluateRuntimeVersions([caseWith(undefined)], 'headless')).toEqual([])
    expect(evaluateRuntimeVersions([{ ...caseWith(undefined), state: 'pending' }], 'devtools')).toEqual([])
  })
})
