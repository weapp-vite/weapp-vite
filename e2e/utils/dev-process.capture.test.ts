import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { startDevProcess } from './dev-process'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

describe('dev process real inherited output capture', () => {
  it.each([false, true])('captures both streams with all=%s and preserves startup diagnostics', async (all) => {
    const dev = startDevProcess(process.execPath, ['-e', `
      process.stdout.write('小程序初次构建完成\\n');
      process.stderr.write('[error] capture regression diagnostic\\n');
      setTimeout(() => {}, 30000);
    `], { stdio: 'inherit', all })
    try {
      await dev.waitForInitialBuild(5_000)
      await dev.waitForOutput('capture regression diagnostic', 'stderr capture', 5_000)
      expect(dev.getOutput().match(/小程序初次构建完成/g)).toHaveLength(1)
      expect(dev.getOutput().match(/capture regression diagnostic/g)).toHaveLength(1)
      expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
        source: 'build',
        level: 'error',
        channel: 'dev-process',
        text: '[error] capture regression diagnostic',
      }))
    }
    finally {
      await dev.stop()
    }
  })
})
