import assert from 'node:assert/strict'
import path from 'node:path'

/** 从 Vitest 的真实 module/case API 记录所有 case，包括原样保留的 skipped 状态。 */
export function captureCoverageCases(modules, root) {
  return modules.flatMap((module) => {
    const file = path.relative(root, module.moduleId).replaceAll('\\', '/')
    assert(file && !file.startsWith('../') && !path.isAbsolute(file), 'Coverage case escaped repository')
    const seen = new Set()
    return [...module.children.allTests()].flatMap((test) => {
      const state = test.result().state
      const key = JSON.stringify([test.fullName, state])
      // Vitest may expose the same collected test more than once when a file
      // is reached through nested project configuration. Treat that callback
      // duplication as one observation while retaining distinct states as a
      // genuine logical conflict for the merge validator.
      if (seen.has(key)) {
        return []
      }
      seen.add(key)
      return [{ file, projectName: module.project.name, name: test.fullName, state }]
    })
  })
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
  assert(cases.length && new Set(reports.flatMap(report => report.cases.map(item => JSON.stringify([item.projectName, item.file, item.name])))).size === cases.length, 'Empty or duplicate logical coverage cases')
  return { files: [...new Set(plan.inventory.map(item => item.file))].sort(), cases: cases.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }
}
