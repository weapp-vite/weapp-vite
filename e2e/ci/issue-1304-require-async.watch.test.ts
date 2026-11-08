import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, it } from 'vitest'
import { exerciseIssue1304Watch } from '../utils/issue1304Watch'
import { startIssueClassicDev } from '../utils/issueClassicDev'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'
import { runWithCleanup } from '../utils/runWithCleanup'

describe('issue #1304: classic require.async publication', { concurrent: false }, () => {
  it('retains live lazy targets across cached rebuilds and removes only obsolete targets before restoring them', async (context) => {
    const project = await createIssueRegressionProject(1304)
    let dev: ReturnType<typeof startIssueClassicDev> | undefined
    let failed = false
    await runWithCleanup(async () => {
      try {
        dev = startIssueClassicDev(project)
        context.onTestFailed(() => {
          process.stdout.write(dev!.getOutput())
        })
        await exerciseIssue1304Watch(project, dev)
      }
      catch (error) {
        failed = true
        await writeFile(path.join(project, 'watch-failure.log'), dev?.getOutput() ?? '')
        process.stdout.write(`[issue-1304] retained failed project: ${path.relative(process.cwd(), project).split(path.sep).join('/')}\n`)
        throw error
      }
    }, async () => {
      await dev?.stop(5_000)
      if (!failed) {
        await rm(project, { recursive: true, force: true })
      }
    })
  }, 240_000)
})
