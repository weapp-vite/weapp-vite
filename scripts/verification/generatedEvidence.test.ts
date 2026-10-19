import { describe, expect, it } from 'vitest'
import { hasVerificationSourceChanges } from './generatedEvidence.ts'

describe('generated verification evidence boundary', () => {
  it('ignores only untracked DOM evidence and exact generated suite indexes', () => {
    const files = [
      'docs/reports/dom-acceptance/run/invocation.json',
      'docs/reports/dom-acceptance/run/evidence file.png',
      'docs/reports/2026-01-02-030405-e2e-ide-dom-headless-1234abcd-suite-report/index.json',
      'docs/reports/2026-01-02-030405-e2e-ide-dom-headless-1234abcd-suite-report/index.md',
    ]
    expect(hasVerificationSourceChanges('', `${files.join('\0')}\0`)).toBe(false)
    expect(hasVerificationSourceChanges(' M docs/reports/dom-acceptance/committed.json\n', `${files.join('\0')}\0`)).toBe(true)
  })

  it.each([
    'src/new case.ts',
    'docs/reports/review.md',
    'docs/reports/dom-acceptance-other/run.json',
    'nested/docs/reports/dom-acceptance/run.json',
    ' docs/reports/dom-acceptance/run.json',
    'docs/reports/2026-01-02-030405-e2e-ci-suite-report/source.ts',
    'docs/reports/2026-01-02-030405-e2e-ci-suite-report/index.json.backup',
    'docs/reports/2026-01-02-030405-e2e-ci-suite-report/nested/index.json',
    'docs/reports/review-suite-report/index.md',
  ])('retains untracked non-evidence file %s', (file) => {
    expect(hasVerificationSourceChanges('', `${file}\0`)).toBe(true)
  })
})
