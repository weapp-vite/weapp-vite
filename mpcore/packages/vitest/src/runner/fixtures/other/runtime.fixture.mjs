import { appendFile } from 'node:fs/promises'
import { threadId } from 'node:worker_threads'
import { inject, test } from 'vitest'

test('unrelated project', async () => {
  await appendFile(inject('mpcoreRunnerEventsFile'), `${JSON.stringify({ project: 'other', threadId })}\n`)
})
