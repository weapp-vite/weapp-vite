import { expect, it } from 'vitest'
import { appendWatcherComparisonDiagnostic } from './syncCandidateTopology.mjs'

function fixture() {
  const frozen = {
    '.github/workflows/validate-ci.yml': { build: { uses: './quality.yml' } },
    '.github/workflows/validate-ci-e2e.yml': { runtime: { needs: 'context', with: { main_command: 'pnpm e2e:ci:full' } } },
  }
  const current = structuredClone(frozen)
  current['.github/workflows/validate-ci-e2e.yml']['watcher-comparison-diagnostic'] = {
    if: 'github.event_name == \'workflow_dispatch\' && inputs.hmr-diagnostic == \'watcher-comparison\'',
    uses: './diagnostic.yml',
  }
  return { frozen, current }
}

it('adds only the reviewed diagnostic and leaves the original snapshot unmodified', () => {
  const { frozen, current } = fixture()
  const original = structuredClone(frozen)
  expect(appendWatcherComparisonDiagnostic(frozen, current)).toEqual(current)
  expect(frozen).toEqual(original)
  expect(frozen['.github/workflows/validate-ci-e2e.yml']).not.toHaveProperty('watcher-comparison-diagnostic')
})

it.each(['command', 'dependency', 'workflow', 'extra job', 'removed job'])('rejects unrelated topology drift while adding the diagnostic: %s', (change) => {
  const { frozen, current } = fixture()
  const runtime = current['.github/workflows/validate-ci-e2e.yml'].runtime
  if (change === 'command') {
    runtime.with.main_command = 'node --version'
  }
  else if (change === 'dependency') {
    runtime.needs = []
  }
  else if (change === 'workflow') {
    current['.github/workflows/validate-ci.yml'].build.uses = './replacement.yml'
  }
  else if (change === 'extra job') {
    current['.github/workflows/validate-ci-e2e.yml'].extra = { uses: './extra.yml' }
  }
  else {
    delete current['.github/workflows/validate-ci-e2e.yml'].runtime
  }
  expect(() => appendWatcherComparisonDiagnostic(frozen, current)).toThrow('不能改写已有拓扑')
})

it('rejects an absent diagnostic instead of generating an incomplete snapshot', () => {
  const { frozen } = fixture()
  expect(() => appendWatcherComparisonDiagnostic(frozen, structuredClone(frozen))).toThrow('缺少已审阅')
})

it('cannot rewrite the diagnostic after its addition is frozen', () => {
  const { frozen, current } = fixture()
  const updated = appendWatcherComparisonDiagnostic(frozen, current)
  expect(appendWatcherComparisonDiagnostic(updated, structuredClone(current))).toEqual(updated)
  const changed = structuredClone(current)
  changed['.github/workflows/validate-ci-e2e.yml']['watcher-comparison-diagnostic'].uses = './replacement.yml'
  expect(() => appendWatcherComparisonDiagnostic(updated, changed)).toThrow('不能改写已有拓扑')
})
