import type { GithubIssuesBuildCaseContext } from './types'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'
import { createIssue892ProjectConfig } from './issue892Project'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #892: preserves Sass asset URLs in production output', async () => {
    const project = await createIssue892ProjectConfig(context.appRoot, 'build')
    const configFile = path.join(import.meta.dirname, 'issue892.config.ts')
    const sharedAppPath = path.join(context.distRoot, 'app.json')
    const sharedApp = await fs.pathExists(sharedAppPath) ? await fs.readFile(sharedAppPath, 'utf8') : undefined

    try {
      await runWeappViteBuildWithLogCapture({
        cliPath: context.cliPath,
        configFile,
        projectConfigFile: project.projectConfigFile,
        projectRoot: context.appRoot,
        platform: 'weapp',
        cwd: context.appRoot,
        label: 'ci:github-issues:issue892',
        outDir: project.outDir,
        skipNpm: true,
      })

      const style = await fs.readFile(
        path.join(project.distRoot, 'styles/issue-892-app.wxss'),
        'utf8',
      )

      expect(style).toContain('.issue-892-unquoted')
      expect(style).toContain('.issue-892-quoted')
      expect(style).toContain('color: #2468ac;')
      expect(style).toContain('goods-1.png')
      expect(style).not.toContain('__VITE_ASSET__')
      expect(style).not.toContain('__VITE_PUBLIC_ASSET__')
      const currentSharedApp = await fs.pathExists(sharedAppPath) ? await fs.readFile(sharedAppPath, 'utf8') : undefined
      expect(currentSharedApp).toBe(sharedApp)
    }
    finally {
      await project.cleanup()
    }
  })
}
