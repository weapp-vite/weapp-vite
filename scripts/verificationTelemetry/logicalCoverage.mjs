import assert from 'node:assert/strict'
import path from 'node:path'

/** 从 Vitest 的真实 module/case API 记录所有 case，包括原样保留的 skipped 状态。 */
export function captureCoverageCases(modules, root) {
  return modules.flatMap(module => [...module.children.allTests()].map((test) => {
    const file = path.relative(root, module.moduleId).replaceAll('\\', '/')
    assert(file && !file.startsWith('../') && !path.isAbsolute(file), 'Coverage case escaped repository')
    return { file, projectName: module.project.name, name: test.fullName, state: test.result().state }
  }))
}

/** 逐轮严格核对真实项目分配，再按文件和 case 比较允许重分项目的逻辑范围。 */
export function coverageLogicalScope(plan, reports) {
  assert(reports.length === plan.shards, 'Missing coverage shards')
  const files = []
  const cases = []
  const indices = new Set()
  for (const report of reports) {
    assert(report.planHash === plan.planHash && report.status === 'passed', 'Coverage shard did not pass its plan')
    assert(Number.isSafeInteger(report.index) && report.index > 0 && report.index <= plan.shards && !indices.has(report.index), 'Duplicate coverage shard')
    indices.add(report.index)
    const assigned = new Set(report.inventory.map(item => JSON.stringify([item.projectName, item.file])))
    files.push(...assigned)
    assert(assigned.size === report.inventory.length && Array.isArray(report.cases), 'Missing or duplicate actual coverage case assignment')
    for (const item of report.cases) {
      assert(assigned.has(JSON.stringify([item.projectName, item.file])) && typeof item.name === 'string' && item.name
        && ['passed', 'skipped'].includes(item.state), 'Coverage case has invalid assignment or unfinished state')
      cases.push([item.file, item.name, item.state])
    }
  }
  const expected = plan.inventory.map(item => JSON.stringify([item.projectName, item.file])).sort()
  assert(new Set(expected).size === expected.length && new Set(files).size === files.length, 'Duplicate coverage project/file assignment')
  assert.deepEqual(files.sort(), expected, 'Coverage project/file assignment is incomplete')
  assert(cases.length && new Set(cases.map(([file, name]) => JSON.stringify([file, name]))).size === cases.length, 'Empty or duplicate logical coverage cases')
  return { files: [...new Set(plan.inventory.map(item => item.file))].sort(), cases: cases.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }
}
