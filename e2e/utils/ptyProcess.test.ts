import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { launchPtyProcess } from './ptyProcess'

function launchNode(source: string) {
  return launchPtyProcess(process.execPath, ['-e', source], { cwd: process.cwd() })
}

describe('native PTY process', () => {
  it('delivers a raw hotkey without a newline through real terminal streams', async () => {
    const child = launchNode(`
      if (!process.stdin.isTTY || !process.stdout.isTTY) process.exit(11)
      process.stdin.setRawMode(true)
      process.stdin.on('data', (data) => {
        if (data.toString() === 's') process.stdout.write('SCREENSHOT_READY\\n')
        if (data.toString() === 'q') process.exit(0)
      })
      process.stdout.write('HOTKEY_READY\\n')
    `)
    try {
      await child.waitForOutput(output => output.includes('HOTKEY_READY'), 5_000, 'startup')
      child.write('s')
      await child.waitForOutput(output => output.includes('SCREENSHOT_READY'), 5_000, 'raw hotkey')
      await child.close({ input: 'q', graceMs: 2_000 })
      expect(await child.waitForExit(100)).toBe(0)
      await child.close()
    }
    finally {
      await child.close()
    }
  })

  it('rejects readiness immediately after early exit and remembers the exit result', async () => {
    const child = launchNode(`process.stderr.write('STARTUP_FAILED\\n', () => process.exit(7))`)
    try {
      await expect(child.waitForOutput(output => output.includes('NEVER_READY'), 30_000, 'startup'))
        .rejects
        .toThrow('PTY process exited with code 7 before startup')
      expect(await child.waitForExit(100)).toBe(7)
      expect(child.output).toContain('STARTUP_FAILED')
    }
    finally {
      await child.close()
    }
  }, 5_000)

  it('cleans up a process that ignores graceful shutdown and termination', async () => {
    const child = launchNode(`
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.on('SIGTERM', () => {})
      process.stdout.write('READY\\n')
    `)
    try {
      await child.waitForOutput(output => output.includes('READY'), 5_000, 'startup')
      await child.close({ input: 'q', graceMs: 20 })
      expect(await child.waitForExit(100)).not.toBeNull()
    }
    finally {
      await child.close()
    }
  })
})
