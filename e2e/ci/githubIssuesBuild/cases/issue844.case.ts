import type { GithubIssuesBuildCaseContext } from './types'
import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export const group = 'issue844'

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = []
  async function visit(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(file)
      }
      else {
        result.push(path.relative(root, file).split(path.sep).join('/'))
      }
    }
  }
  await visit(root)
  return result
}

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #844: prunes npm files from the final component closure', async () => {
    const outDir = path.join(context.appRoot, 'dist')
    await fs.rm(outDir, { recursive: true, force: true })
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:github-issues:issue844',
      env: { WEAPP_GITHUB_ISSUE_844_PRUNE: 'true' },
      outDir: 'dist',
    })

    for (const root of [
      'miniprogram_npm/tdesign-miniprogram',
      'subpackages/issue-844-normal/miniprogram_npm/tdesign-miniprogram',
      'subpackages/issue-844-independent/miniprogram_npm/tdesign-miniprogram',
    ]) {
      const files = await listFiles(path.join(outDir, root))
      expect(files).toContain('button/button.js')
      expect(files).toContain('common/style/index.wxss')
      expect(files).not.toContain('dialog/index.js')
      expect(files).not.toContain('calendar/index.js')
      expect(files.some(file => file.endsWith('.d.ts'))).toBe(false)
    }
  })
}
