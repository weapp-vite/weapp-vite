import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

// 通过独立进程验证真实流输出，避免 logger mock 隐藏 stdout 污染。
describe('IDE diagnostics protocol boundary', () => {
  it('keeps JSON stdout parseable and preserves diagnostics on stderr', async () => {
    const loggerUrl = new URL('../src/logger.ts', import.meta.url).href
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      String.raw`import logger from ${JSON.stringify(loggerUrl)};
       logger.info('selected-cli');
       logger.warn('connection-retry');
       logger.error('connection-failed');
       logger.withTag('runtime').success('recovered');
       process.stdout.write(JSON.stringify({ passed: true }) + '\n');`,
    ], { cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, CONSOLA_LEVEL: '3' } })
    expect(JSON.parse(stdout)).toEqual({ passed: true })
    for (const diagnostic of ['selected-cli', 'connection-retry', 'connection-failed', 'recovered']) {
      expect(stderr).toContain(diagnostic)
    }
  })
})
