import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const PROJECT_CONFIG_PATHS = [
  ':(glob)**/project.config.json',
  ':(glob)**/project.private.config.json',
  ':(glob)**/project.swan.json',
]

/** 只从 Git 索引读取需要检查的配置，避免无关报告文件耗尽子进程输出缓冲。 */
export function listTrackedProjectConfigs(root: string) {
  const result = spawnSync('git', ['ls-files', '-z', '--', ...PROJECT_CONFIG_PATHS], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.error) {
    throw result.error
  }
  assert.equal(result.status, 0, result.stderr || `git ls-files failed (signal: ${result.signal ?? 'none'})`)
  return result.stdout.split('\0').filter(Boolean)
}
