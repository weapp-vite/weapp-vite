import { Buffer } from 'node:buffer'
import * as childProcess from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listTrackedProjectConfigs } from './trackedConfigs'

vi.mock('node:child_process', { spy: true })

describe('tracked mini-program project configs', () => {
  let root: string

  function git(args: string[], input?: string) {
    const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8', input })
    if (result.error) {
      throw result.error
    }
    expect(result.status, result.stderr).toBe(0)
    return result.stdout
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'project-config-index-'))
    git(['init', '--quiet'])
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  function track(files: string[]) {
    const blob = git(['hash-object', '-w', '--stdin'], '').trim()
    git(['update-index', '-z', '--index-info'], files.map(file => `100644 ${blob}\t${file}\0`).join(''))
  }

  it('includes exact root and nested configuration names with spaces and Unicode', () => {
    const configs = [
      'project.config.json',
      'project.private.config.json',
      'project.swan.json',
      'apps/example/project.config.json',
      'apps/with spaces/project.private.config.json',
      'apps/示例/project.swan.json',
      'apps/example/config/xhs/project.config.json',
    ]
    track([...configs, 'project.config.json.backup', 'apps/example/not-project.config.json', 'docs/project.swan.json/other.json'])
    expect(listTrackedProjectConfigs(root).sort()).toEqual(configs.sort())
  })

  it('does not capture a repository-wide file list larger than the default output buffer', () => {
    const reports = Array.from({ length: 6000 }, (_, index) => `docs/reports/${'unrelated-'.repeat(16)}/${index}/entry-summary.json`)
    expect(Buffer.byteLength(`${reports.join('\0')}\0`)).toBeGreaterThan(1024 * 1024)
    const configs = ['project.config.json', 'apps/example/project.private.config.json', 'apps/swan/project.swan.json']
    // 仅写 Git 索引，避免为输出缓冲回归制造数千个真实文件或依赖机器性能的耗时断言。
    track([...configs, ...reports])
    expect(listTrackedProjectConfigs(root).sort()).toEqual(configs.sort())
  })

  it('preserves the original spawn error instead of replacing it with a null status assertion', () => {
    const error = Object.assign(new Error('spawn git ENOBUFS'), { code: 'ENOBUFS' })
    vi.mocked(childProcess.spawnSync).mockReturnValueOnce({
      pid: 0,
      output: [null, '', ''],
      stdout: '',
      stderr: '',
      status: null,
      signal: 'SIGTERM',
      error,
    })
    let caught: unknown
    try {
      listTrackedProjectConfigs(root)
    }
    catch (cause) {
      caught = cause
    }
    expect(caught).toBe(error)
  })
})
