import assert from 'node:assert/strict'
import { classifyCoverageScope, coverageScopePolicy } from './coveragePolicy.mjs'

/** 只有已审计的精确证据全集和无缺口发现结果才能生成可提交的正式合约。 */
export function completeTelemetryContract(preparation, expectedIds) {
  assert(preparation?.kind === 'ci-benchmark-preparation' && preparation.formalSample === false, 'Formal contract requires verified native CI preparation')
  assert(Array.isArray(expectedIds) && expectedIds.length && new Set(expectedIds).size === expectedIds.length, 'Formal contract requires an exact reviewed evidence-id inventory')
  assert(Array.isArray(preparation.gaps) && preparation.gaps.every(gap => gap.id === 'review'), 'Cannot finalize a contract with missing execution evidence')
  const contract = preparation.contract
  assert(contract?.schemaVersion === 1 && contract.draft === true && contract.inputPolicy, 'Missing versioned draft contract and framework input policy')
  assert.deepEqual(contract.needs, preparation.configuration?.needs, 'Frozen topology differs from native preparation')
  assert.deepEqual(contract.outOfScope, preparation.configuration?.outOfScope, 'Frozen skipped branches differ from native preparation')
  assert.deepEqual(contract.evidence.map(entry => entry.id).sort(), [...expectedIds].sort(), 'Formal contract does not contain the exact reviewed evidence inventory')
  assert(['coverage', 'runtime', 'task-suite'].every(kind => contract.evidence.some(entry => entry.kind === kind)), 'Formal contract is missing a required execution layer')
  for (const entry of contract.evidence.filter(entry => entry.kind === 'coverage')) {
    const scope = entry.scopeLevel === 'audited-cases' ? entry.scope?.product : entry.scope
    assert(['logical-cases', 'audited-cases'].includes(entry.scopeLevel)
      && Array.isArray(scope?.files) && scope.files.length && Array.isArray(scope?.cases) && scope.cases.length, 'Formal contract requires actual logical coverage cases with exact project assignment verification')
    if (entry.scopeLevel === 'audited-cases') {
      assert.deepEqual(entry.scopePolicy, coverageScopePolicy, 'Formal coverage classification policy changed')
      assert.deepEqual(entry.scope.policy, coverageScopePolicy, 'Formal coverage classification receipt changed')
      assert(Array.isArray(entry.scope.validation?.files) && Array.isArray(entry.scope.validation?.cases)
        && Array.isArray(entry.scope.classification), 'Formal coverage classification evidence is incomplete')
      const full = {
        files: [...scope.files, ...entry.scope.validation.files].sort(),
        cases: [...scope.cases, ...entry.scope.validation.cases].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      }
      assert(full.cases.every(([file, name, state]) => full.files.includes(file) && typeof name === 'string' && name
        && ['passed', 'skipped'].includes(state)), 'Formal coverage contains invalid or unfinished cases')
      assert(new Set(full.files).size === full.files.length
        && new Set(full.cases.map(([file, name]) => JSON.stringify([file, name]))).size === full.cases.length, 'Formal coverage contains duplicate cases or files')
      assert.deepEqual(entry.scope, classifyCoverageScope(full), 'Formal coverage classification does not match the actual full scope')
    }
  }
  return { ...contract, draft: false }
}
