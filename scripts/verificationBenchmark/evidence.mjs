import { createHash } from 'node:crypto'
import { readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { assertAcceptanceReportPassed } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'

export function evidenceDigest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function requireComplete(report) {
  if (report.coverage !== 'complete' || report.acceptance !== 'passed'
    || report.execution?.scope !== 'full' || report.execution.status !== 'passed'
    || report.workingTreeDirty !== false || report.strict !== true) {
    throw new Error('Performance acceptance needs a clean, complete successful runtime report')
  }
  const tasks = report.tasks.filter(task => task.status !== 'out-of-scope')
  const assigned = report.execution.assignedTasks
  if (!tasks.length || new Set(assigned).size !== assigned.length
    || assigned.length !== tasks.length || new Set(tasks.map(task => task.label)).size !== tasks.length
    || tasks.some(task => !assigned.includes(task.label) || task.status !== 'passed' || task.exitCode !== 0
      || !Number.isFinite(task.durationMs) || task.durationMs <= 0)) {
    throw new Error('Runtime performance report has incomplete or duplicate tasks')
  }
  return tasks
}

/** 比较时使用逻辑 case/checkpoint 集合，避免会话聚合前后文件分组不同。 */
export function runtimeScope(report, acceptanceReports) {
  const tasks = requireComplete(report)
  if (!Array.isArray(acceptanceReports) || !acceptanceReports.length) {
    throw new Error('Runtime benchmark requires actual case and checkpoint evidence')
  }
  const expected = tasks.reduce((sum, task) => sum + task.artifacts.filter(artifact => artifact.kind === 'dom-acceptance-report').length, 0)
  if (expected !== acceptanceReports.length) {
    throw new Error('Runtime benchmark is missing acceptance invocations')
  }
  const entries = []
  const invocations = new Set()
  for (const value of acceptanceReports) {
    assertAcceptanceReportPassed(value, report)
    if (invocations.has(value.invocationId) || value.provider !== report.execution.profile.provider
      || !tasks.some(task => task.label === value.taskLabel)) {
      throw new Error('Acceptance evidence has wrong or duplicate identity')
    }
    invocations.add(value.invocationId)
    for (const item of value.cases) {
      if (item.state === 'skipped' && item.status === 'skipped' && !item.acceptance && item.violations.length === 0) {
        entries.push([`source-skip:${value.template ?? ''}:${item.file}:${item.name}`, [], 'skipped'])
        continue
      }
      if (item.status !== 'passed' || !item.acceptance) {
        throw new Error('Acceptance evidence contains an unexecuted or failed checkpoint')
      }
      entries.push([`${item.acceptance.fixture}:${item.name}`, [...item.acceptance.checkpoints].sort((left, right) => left.id.localeCompare(right.id))])
    }
  }
  if (new Set(entries.map(entry => entry[0])).size !== entries.length) {
    throw new Error('Duplicate logical runtime cases')
  }
  return entries.sort(([left], [right]) => left.localeCompare(right))
}

/** 输入按相对路径与文件内容绑定，不把提交号或工具实现改动混进框架输入摘要。 */
export async function inputDigest(root, files) {
  if (!files.length || new Set(files).size !== files.length) {
    throw new Error('Benchmark input file inventory is empty or duplicated')
  }
  const entries = []
  const actualRoot = await realpath(root)
  for (const file of [...files].sort()) {
    if (typeof file !== 'string' || file.includes('\\') || path.posix.isAbsolute(file) || /^[a-z]:/iu.test(file) || file.split('/').some(part => !part || part === '..' || part === '.')) {
      throw new Error('Benchmark inputs must be normalized repository-relative files')
    }
    const actual = await realpath(path.join(root, file))
    const relative = path.relative(actualRoot, actual)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('Benchmark input escapes its workspace')
    }
    entries.push([file, createHash('sha256').update(await readFile(actual)).digest('hex')])
  }
  return evidenceDigest(entries)
}

/** 构建摘要只在同一工作树内检查新鲜度，不要求跨工作树的 chunk 名和 sourcemap 完全相同。 */
export async function artifactSnapshot(root, directories = []) {
  if (!Array.isArray(directories) || new Set(directories).size !== directories.length) {
    throw new Error('Invalid benchmark artifact directories')
  }
  const files = []
  const visit = async (directory) => {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        await visit(relative)
      }
      else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(relative)
      }
    }
  }
  for (const directory of [...directories].sort()) {
    if (typeof directory !== 'string' || !/^(?:packages|packages-runtime|packages-private|@weapp-core|mpcore\/packages)\/[^/]+\/dist$/u.test(directory)
      || directory.split('/').some(part => part === '..' || part === '.')) {
      throw new Error('Benchmark artifacts must use explicit workspace package dist directories')
    }
    await visit(directory)
  }
  return { files: files.sort(), digest: files.length ? await inputDigest(root, files) : null }
}
