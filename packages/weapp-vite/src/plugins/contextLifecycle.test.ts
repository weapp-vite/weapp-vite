import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const runNode = promisify(execFile)

describe('plugin context lifetime', () => {
  it.each(['page-matcher', 'output-publication', 'pending-output-publication'])('does not keep a finished hook context through %s state', async (scenario) => {
    const worker = new URL('./fixtures/contextLifecycle.ts', import.meta.url)
    const { stdout } = await runNode(process.execPath, ['--expose-gc', '--import', 'tsx', fileURLToPath(worker), scenario], {
      timeout: 20_000,
    })
    expect(JSON.parse(stdout)).toEqual({ scenario, collected: true })
  }, 25_000)
})
