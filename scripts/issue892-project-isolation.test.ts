import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { describe, expect, it } from 'vitest'
import { createIssue892ProjectConfig } from '../e2e/ci/githubIssuesBuild/cases/issue892Project'

describe('issue #892 project output isolation', () => {
  it('preserves the source project and its shared output while assigning separate build and dev roots', async () => {
    const appRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'issue-892-project-'))
    const config = { miniprogramRoot: 'dist/', setting: { es6: true }, compileType: 'miniprogram' }
    const sharedApp = { pages: ['pages/first/index', 'pages/second/index'] }
    try {
      await fs.writeJSON(path.join(appRoot, 'project.config.json'), config)
      await fs.outputJSON(path.join(appRoot, 'dist/app.json'), sharedApp)
      const build = await createIssue892ProjectConfig(appRoot, 'build')
      const dev = await createIssue892ProjectConfig(appRoot, 'dev')
      expect(build.projectConfigFile).not.toBe(dev.projectConfigFile)
      expect(build.distRoot).not.toBe(dev.distRoot)
      for (const project of [build, dev]) {
        const isolatedConfig = await fs.readJSON(project.projectConfigFile) as Record<string, unknown>
        expect(isolatedConfig).toEqual({ ...config, miniprogramRoot: project.outDir })
        expect(path.resolve(appRoot, String(isolatedConfig.miniprogramRoot))).toBe(project.distRoot)
        expect(project.distRoot).not.toBe(path.join(appRoot, 'dist'))
        await project.cleanup()
        await expect(fs.pathExists(project.projectConfigFile)).resolves.toBe(false)
      }
      await expect(fs.readJSON(path.join(appRoot, 'project.config.json'))).resolves.toEqual(config)
      await expect(fs.readJSON(path.join(appRoot, 'dist/app.json'))).resolves.toEqual(sharedApp)
    }
    finally {
      await fs.remove(appRoot)
    }
  })
})
