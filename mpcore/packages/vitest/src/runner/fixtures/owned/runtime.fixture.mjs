import { appendFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { threadId } from 'node:worker_threads'
import { createMpcoreTest } from '@mpcore/vitest'
import { inject } from 'vitest'

const test = createMpcoreTest()
for (const scenario of ['mutates first runtime', 'starts another clean runtime']) {
  test(scenario, async ({ mpcore, expect }) => {
    const revision = basename(inject('mpcoreArtifact').projectPath)
    const result = await mpcore.renderPage('/pages/index/index')
    expect(result.screen.getByText(revision)).toBeInTheMiniProgram()
    expect(result.screen.getByText('count: 1')).toBeInTheMiniProgram()
    await result.user.tap(result.screen.getByRole('button', { name: 'add' }))
    expect(result.screen.getByText('count: 2')).toBeInTheMiniProgram()
    await appendFile(inject('mpcoreRunnerEventsFile'), `${JSON.stringify({ project: 'mpcore', revision, scenario, threadId })}\n`)
  })
}
