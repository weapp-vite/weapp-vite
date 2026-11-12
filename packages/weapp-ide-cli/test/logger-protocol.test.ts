import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

// 通过独立进程验证真实流输出，避免 logger mock 隐藏 stdout 污染。
describe('IDE diagnostics protocol boundary', () => {
  it.each([
    { tty: true, ci: '', term: 'xterm-256color', linked: true },
    { tty: false, ci: '', term: 'xterm-256color', linked: false },
    { tty: true, ci: 'true', term: 'xterm-256color', linked: false },
    { tty: true, ci: '', term: 'dumb', linked: false },
  ])('preserves paths and JSON with $tty TTY, CI=$ci, TERM=$term', async ({ tty, ci, term, linked }) => {
    const loggerUrl = new URL('../src/logger.ts', import.meta.url).href
    const formatterUrl = new URL('../src/terminalPath.ts', import.meta.url).href
    const cliPath = path.resolve('fixtures', '微信 tools #%?', 'cli')
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `Object.defineProperty(process.stderr, 'isTTY', { value: ${tty} });
       const { default: logger } = await import(${JSON.stringify(loggerUrl)});
       const { formatTerminalPath } = await import(${JSON.stringify(formatterUrl)});
       const cliPath = process.argv[1];
       logger.info('CLI 路径： ' + formatTerminalPath(cliPath));
       process.stdout.write(JSON.stringify({ cliPath }));`,
      cliPath,
    ], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, CI: ci, TERM: term, NO_COLOR: '1', FORCE_COLOR: '0', CONSOLA_LEVEL: '3' },
    })
    expect(JSON.parse(stdout)).toEqual({ cliPath })
    expect(stderr).toContain(`CLI 路径： ${linked ? pathToFileURL(cliPath).href : cliPath}`)
    expect(stderr).not.toContain('\u001B')
  })

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
