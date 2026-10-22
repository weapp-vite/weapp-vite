import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { ClassicIdeConfigOwner } from '../../packages/weapp-vite/src/runtime/classicIdeConfig'
import { startDevProcess } from './dev-process'

const packageRoot = fileURLToPath(new URL('../../packages/weapp-vite/', import.meta.url))
const cliEntry = path.join(packageRoot, 'dist/cli.mjs')

it('normally closes an active classic watch build before releasing its configuration to the next session', async () => {
  await access(cliEntry)
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'dev-process-active-watch-close-')))
  const original = '{\r\n\t"setting": { "compileHotReLoad": true }, "description": "user config"\r\n}\r\n'
  const config = path.join(root, 'project.private.config.json')
  const journal = path.join(root, '.weapp-vite/ide-classic-project.private.config.json')
  const files = {
    'package.json': JSON.stringify({ name: 'active-watch-close-regression', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': original,
    'src/app.js': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.js': 'Page({ data: { marker: "watch-close" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>{{marker}}</view>',
    'vite.config.mjs': `
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
let active = false;
process.once('exit', code => console.log('fixture normal watch exit=' + code));
export default {
  weapp: {
    srcRoot: 'src', autoRoutes: false,
    vue: { enable: false }, npm: { enable: false }, mcp: false,
    hmr: { runtime: 'classic' },
  },
  plugins: [{
    name: 'active-watch-close-observer',
    async transform(code, id) {
      if (active || !id.endsWith('app.js') || !code.includes('fixture-watch-update')) return;
      active = true;
      const stopRequested = new Promise(resolve => process.once('disconnect', resolve));
      console.log('fixture watch transform started');
      await stopRequested;
      console.log('fixture watch close requested');
      // 明确覆盖超过旧 5 秒 grace 的在途构建，不重试、不追加写入、不放宽退出回执。
      await delay(6_000);
      console.log('fixture watch transform completed');
    },
  }],
};
`,
  }
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  await mkdir(path.join(root, 'node_modules'))
  await symlink(packageRoot, path.join(root, 'node_modules/weapp-vite'), 'junction')
  const dev = startDevProcess(process.execPath, [cliEntry, 'dev', root, '--no-mcp', '--non-interactive'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development', CONSOLA_LEVEL: '3' },
  })
  const next = new ClassicIdeConfigOwner()
  try {
    await dev.waitForInitialBuild(20_000)
    await expect(access(journal)).resolves.toBeUndefined()
    await writeFile(path.join(root, 'src/app.js'), 'App({ globalData: { marker: "fixture-watch-update" } })')
    await dev.waitForOutput('fixture watch transform started', 'an active classic watch transform', 20_000)
    const stopping = dev.stop(5_000, { gracefulTimeoutMs: 15_000 })
    expect(dev.stop(5_000)).toBe(stopping)
    await stopping
    const output = dev.getOutput()
    expect(output).toContain('fixture watch close requested')
    expect(output).toContain('fixture watch transform completed')
    expect(output).toContain('fixture normal watch exit=0')
    await expect(access(journal)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(config, 'utf8')).toBe(original)
    await next.activate(config)
    await next.close()
    expect(await readFile(config, 'utf8')).toBe(original)
  }
  finally {
    await dev.stop(5_000, { gracefulTimeoutMs: 500 }).catch(() => {})
    await next.close().catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
}, 120_000)
