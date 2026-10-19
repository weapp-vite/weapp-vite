import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { localRelative, localSave } from './localIo.mjs'

const key = item => JSON.stringify([item.projectName, item.file, item.name])

export function validateLocalVitest(report) {
  assert(report.schemaVersion === 1 && report.passed === true && report.reason !== 'interrupted' && report.errors.length === 0, 'Local Vitest invocation did not finish successfully')
  const files = report.plannedFiles.map(item => JSON.stringify([item.projectName, item.file])).sort()
  const actual = report.files.map(item => JSON.stringify([item.projectName, item.file])).sort()
  assert(files.length && new Set(files).size === files.length, 'Local Vitest has an empty or duplicate planned file inventory')
  assert.deepEqual(actual, files, 'Local Vitest file inventory is incomplete')
  assert(report.collected.length && new Set(report.collected.map(key)).size === report.collected.length, 'Local Vitest case inventory is empty or duplicated')
  assert.deepEqual(report.cases.map(key).sort(), report.collected.map(key).sort(), 'Local Vitest case inventory changed after collection')
  for (const item of report.cases) {
    const planned = report.collected.find(value => key(value) === key(item))
    assert(files.includes(JSON.stringify([item.projectName, item.file])) && item.mode === planned.mode
      && item.mode !== 'only' && ['passed', 'skipped'].includes(item.state), 'Local Vitest contains failed, filtered or unfinished cases')
  }
  return { files: actual, cases: report.cases.map(item => [item.file, item.projectName, item.name, item.mode, item.state, item.note ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }
}

export default class LocalVerificationReporter {
  plannedFiles = []
  collected = []
  onInit() {
    this.root = process.env.WEAPP_VITE_VERIFICATION_LOCAL_ROOT
    this.directory = process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR
    this.runId = process.env.WEAPP_VITE_VERIFICATION_LOCAL_RUN
    this.taskId = process.env.WEAPP_VITE_VERIFICATION_LOCAL_TASK
    this.taskInvocation = process.env.WEAPP_VITE_VERIFICATION_LOCAL_INVOCATION
    assert(this.root && this.directory && this.runId && this.taskId && this.taskInvocation, 'Missing local reporter ownership identity')
    localRelative(this.root, this.directory)
    this.startedAt = new Date().toISOString()
  }

  file(module) {
    const file = path.relative(this.root, module.moduleId).replaceAll('\\', '/')
    assert(file && !file.startsWith('../') && !path.isAbsolute(file), 'Local Vitest module escaped the measured checkout')
    return { file, projectName: module.project.name }
  }

  cases(module, completed = false) {
    return [...module.children.allTests()].map(test => ({ ...this.file(module), name: test.fullName, mode: test.options.mode, ...(completed ? { state: test.result().state, note: test.result().note ?? null } : {}) }))
  }

  onTestRunStart(specifications) {
    this.plannedFiles = specifications.map(specification => this.file(specification))
  }

  onTestModuleCollected(module) {
    this.collected.push(...this.cases(module))
  }

  async onTestRunEnd(modules, errors, reason) {
    const invocationId = randomUUID()
    const report = {
      schemaVersion: 1,
      runId: this.runId,
      taskId: this.taskId,
      taskInvocation: this.taskInvocation,
      invocationId,
      nodeVersion: process.version,
      runtimeTaskLabel: process.env.WEAPP_VITE_E2E_ACCEPTANCE_TASK ?? null,
      template: process.env.WEAPP_VITE_E2E_TEMPLATE ?? null,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      plannedFiles: this.plannedFiles,
      collected: this.collected,
      files: modules.map(module => this.file(module)),
      cases: modules.flatMap(module => this.cases(module, true)),
      errors: errors.map(error => String(error.message ?? error)),
      reason,
      passed: reason !== 'interrupted' && errors.length === 0 && modules.every(module => ['passed', 'skipped'].includes(module.state())),
    }
    const file = path.join(this.directory, 'vitest', `${invocationId}.json`)
    await localSave(file, report)
    process.stdout.write(`[verification-local-case] index=${localRelative(this.root, file)}\n`)
  }
}
