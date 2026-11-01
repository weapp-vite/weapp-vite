import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立进程在 Vite 捕获 stat 之前安装真实注册 gate，并传播跨平台超时与原始错误。
import { execa } from 'execa'
import { expect, it } from 'vitest'

it('keeps real source registration pending before ready when Vite watches missing environment files', async () => {
  const script = fileURLToPath(new URL('./missingEnvReady.mjs', import.meta.url))
  const { stdout } = await execa(process.execPath, [script], {
    timeout: 30_000,
    env: { CHOKIDAR_USEPOLLING: 'false' },
  })
  const report = JSON.parse(stdout) as { status: string, checks: string[] }
  expect(report).toEqual({
    status: 'passed',
    checks: ['missing-env-ready-after-source-registration', 'native-source-save-after-ready'],
  })
}, 40_000)
