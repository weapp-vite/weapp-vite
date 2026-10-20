import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { coverageIdentity, coveragePlan, normalizeInventory, saveJson } from './coverage.mjs'
import { captureCoverageCases } from './logicalCoverage.mjs'

export default class BaselineCoverageReporter {
  constructor(options = {}) {
    this.explicitRoot = options.root
    this.root = options.root ?? process.cwd()
    this.output = options.output ?? path.join(this.root, '.tmp/verification-telemetry/coverage')
    this.identity = options.identity
  }

  onInit(context) {
    if (!this.explicitRoot) {
      this.root = context.config.root
      this.output = path.join(this.root, '.tmp/verification-telemetry/coverage')
    }
  }

  /** 在真实执行开始时冻结 Vitest 已发现的精确项目与文件集合。 */
  async onTestRunStart(specifications) {
    this.start = performance.now()
    await Promise.all(['plan.json', 'observed.json', 'manifest.json', 'blob.json', 'logical-scope.json', 'shard-verdict.json'].map(file => fs.rm(path.join(this.output, file), { force: true })))
    const inventory = normalizeInventory(specifications.map(item => ({ file: item.moduleId, projectName: item.project.name })), this.root)
    this.plan = coveragePlan(this.identity ?? await coverageIdentity(this.root), inventory)
    await saveJson(path.join(this.output, 'plan.json'), this.plan)
  }

  /** 测试结束只记录实际观测；不能提前声称后续覆盖率阈值或整个命令成功。 */
  async onTestRunEnd(modules, errors, reason) {
    if (!this.plan) {
      throw new Error('Coverage run ended without a frozen actual discovery plan')
    }
    const cases = captureCoverageCases(modules, this.root)
    await saveJson(path.join(this.output, 'observed.json'), {
      inventory: normalizeInventory(modules.map(module => ({ file: module.moduleId, projectName: module.project.name })), this.root),
      cases,
      passed: reason !== 'interrupted' && errors.length === 0 && modules.every(module => ['passed', 'skipped'].includes(module.state())),
      durationMs: performance.now() - this.start,
    })
  }
}
