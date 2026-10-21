import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { normalizeInventory } from './contracts.mjs'

export default class CoverageInventoryReporter {
  /** 从真实完成的测试模块记录归属，列表命令不参与实际分片判定。 */
  async onTestRunEnd(modules, errors) {
    const filename = process.env.COVERAGE_SHARD_REPORT
    if (!filename) {
      throw new Error('Missing COVERAGE_SHARD_REPORT')
    }
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, JSON.stringify({
      inventory: normalizeInventory(modules.map(module => ({ file: module.moduleId, projectName: module.project.name })), process.cwd()),
      passed: errors.length === 0 && modules.every(module => ['passed', 'skipped'].includes(module.state())),
    }))
  }
}
