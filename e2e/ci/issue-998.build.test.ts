/* eslint-disable e18e/ban-dependencies -- 回归需要捕获真实 CLI 压缩警告。 */
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sanitizeBuildCommandEnv } from '../utils/buildLog'
import { createIssue998Project, ISSUE_998_CLI, ISSUE_998_ROOT } from '../utils/issue998Project'

let project: string

describe('issue #998: managed CSS imported through multiple owners', () => {
  beforeAll(async () => {
    project = await createIssue998Project()
  })
  afterAll(async () => {
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  it('transforms styles + cssEntries + inline SFC import before CSS minification', async () => {
    const result = await execa(process.execPath, [ISSUE_998_CLI, 'build', project], {
      cwd: ISSUE_998_ROOT,
      all: true,
      extendEnv: false,
      env: sanitizeBuildCommandEnv(),
    })
    expect(result.all).not.toMatch(/Unknown at rule|lightningcss minify/)
    const css = await readFile(path.join(project, 'dist/app.wxss'), 'utf8')
    expect(css).not.toMatch(/@(?:theme|source|tailwind|apply)\b/)
    expect(css).toContain('#fce7f3')
    expect(css.match(/\.ordinary\{/g)).toHaveLength(1)
    expect(css).toMatch(/\.ordinary\{(?:color:red;padding:0|padding:0;color:red)\}/)
    const pageCss = await readFile(path.join(project, 'dist/pages/index/index.wxss'), 'utf8')
    expect(pageCss).toContain('#1f2937')
  })
})
