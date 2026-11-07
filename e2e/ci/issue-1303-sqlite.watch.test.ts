import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, it } from 'vitest'
import { createIssue1303Project, exerciseIssue1303Watch } from '../utils/issue1303Sqlite'
import { startIssueClassicDev } from '../utils/issueClassicDev'
import { runWithCleanup } from '../utils/runWithCleanup'

describe.each(['existing-subpackage', 'generated-subpackage'] as const)('issue #1303: SQLite classic dev %s', (mode) => {
  it('starts, runs real SQLite, remains idle for 120 seconds and rebuilds without rewriting generated sources', async (context) => {
    const project = await createIssue1303Project(mode)
    let dev: ReturnType<typeof startIssueClassicDev> | undefined
    let failed = false
    await runWithCleanup(async () => {
      try {
        dev = startIssueClassicDev(project)
        context.onTestFailed(() => {
          process.stdout.write(dev!.getOutput())
        })
        await exerciseIssue1303Watch(project, mode, dev)
      }
      catch (error) {
        failed = true
        await writeFile(path.join(project, 'watch-failure.log'), dev?.getOutput() ?? '')
        process.stdout.write(`[issue-1303] retained failed project: ${path.relative(process.cwd(), project).split(path.sep).join('/')}\n`)
        throw error
      }
    }, async () => {
      await dev?.stop(5_000)
      if (!failed) {
        await rm(project, { recursive: true, force: true })
      }
    })
  }, 300_000)
})
