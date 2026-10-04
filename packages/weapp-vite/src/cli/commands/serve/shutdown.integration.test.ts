import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const cliEntry = path.join(packageRoot, 'dist/cli.mjs')
const privateConfig = '{\r\n\t"setting" : { "compileHotReLoad": true },\r\n\t"watchOptions": { "ignore": ["scratch/**"] }\r\n}\r\n'
const phases = ['initial', 'ready'] as const
const requests = ['SIGINT', 'SIGTERM', 'disconnect'] as const
type Phase = typeof phases[number]
type Request = typeof requests[number]

async function createProject() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'weapp-vite-serve-shutdown-')))
  const files = {
    'package.json': JSON.stringify({ name: 'serve-shutdown-regression', private: true, type: 'module' }),
    'project.config.json': JSON.stringify({ appid: 'wxb3d842a4a7e3440d', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/' }),
    'project.private.config.json': privateConfig,
    'src/app.js': 'App({})',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.js': 'Page({ data: { marker: "shutdown" } })',
    'src/pages/index/index.json': '{}',
    'src/pages/index/index.wxml': '<view>{{marker}}</view>',
    'vite.config.mjs': `
import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
const lease = path.join(process.cwd(), '.weapp-vite', 'ide-asset-watch.json');
const journal = path.join(process.cwd(), 'shutdown-events.txt');
let paused = false;
// Windows 的 kill 不派发可捕获的 POSIX 信号，用 IPC 进入同一个信号处理边界。
if (process.platform === 'win32') {
  process.on('message', message => {
    if (message === 'SIGINT' || message === 'SIGTERM') process.emit(message);
  });
}
export default {
  weapp: {
    srcRoot: 'src', autoRoutes: false,
    vue: { enable: false }, npm: { enable: false }, mcp: false,
    hmr: { runtime: 'stateful-experimental' },
  },
  plugins: [{
    name: 'serve-shutdown-observer',
    async transform(_code, id) {
      if (process.env.SHUTDOWN_TEST_PHASE !== 'initial' || paused || !id.endsWith('app.js') || !existsSync(lease)) return;
      paused = true;
      const requested = new Promise(resolve => process.once(process.env.SHUTDOWN_TEST_REQUEST, resolve));
      process.send?.('initial');
      await requested;
      await delay(100);
    },
    async closeServer() {
      const repeated = process.env.SHUTDOWN_TEST_PHASE === 'ready' && process.env.SHUTDOWN_TEST_REQUEST === 'SIGINT'
        ? new Promise(resolve => process.once('message', resolve))
        : undefined;
      await appendFile(journal, 'cleanup-start\\n');
      if (process.connected) process.send?.('cleanup-start');
      await repeated;
      await delay(150);
      await appendFile(journal, 'cleanup-finished\\n');
    },
  }],
};
`,
  }
  for (const [relative, content] of Object.entries(files)) {
    const filename = path.join(root, relative)
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, content)
  }
  await mkdir(path.join(root, 'node_modules'))
  await symlink(packageRoot, path.join(root, 'node_modules/weapp-vite'), 'junction')
  return root
}

async function withTimeout<T>(task: Promise<T>, diagnostics: () => string, timeout = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`CLI shutdown timed out:\n${diagnostics()}`)), timeout)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

function requestShutdown(child: ChildProcess, request: Request) {
  if (request === 'disconnect') {
    child.disconnect()
  }
  else if (process.platform === 'win32') {
    child.send(request)
  }
  else {
    child.kill(request)
  }
}

describe('built serve CLI shutdown', () => {
  it.each(phases.flatMap(phase => requests.map(request => ({ phase, request }))))('restores the stateful lease after $request during $phase', async ({ phase, request }: { phase: Phase, request: Request }) => {
    // CLI 回归必须消费新构建的包，不能用 source import 替代下游入口。
    await access(cliEntry)
    const root = await createProject()
    let output = ''
    const reached = Promise.withResolvers<void>()
    const cleanupStarted = Promise.withResolvers<void>()
    const finished = Promise.withResolvers<{ code: number | null, signal: NodeJS.Signals | null }>()
    const child = spawn(process.execPath, [cliEntry, 'dev', root, '--no-mcp', '--non-interactive'], {
      cwd: root,
      // 子进程以真实开发命令启动，避免测试父进程在 logger 导入时静默就绪日志。
      env: { ...process.env, NODE_ENV: 'development', CONSOLA_LEVEL: '3', SHUTDOWN_TEST_PHASE: phase, SHUTDOWN_TEST_REQUEST: request },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })
    const collect = (chunk: unknown) => {
      output += String(chunk)
      if (phase === 'ready' && output.includes('开发服务已就绪')) {
        reached.resolve()
      }
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('message', (message) => {
      if (message === phase) {
        reached.resolve()
      }
      if (message === 'cleanup-start') {
        cleanupStarted.resolve()
      }
    })
    child.once('error', error => finished.reject(error))
    child.once('exit', (code, signal) => finished.resolve({ code, signal }))
    try {
      await withTimeout(Promise.race([
        reached.promise,
        finished.promise.then((result) => {
          throw new Error(`CLI exited before ${phase}: ${JSON.stringify(result)}\n${output}`)
        }),
      ]), () => output)
      const lease = path.join(root, '.weapp-vite/ide-asset-watch.json')
      await expect(access(lease)).resolves.toBeUndefined()
      expect(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).not.toBe(privateConfig)
      requestShutdown(child, request)
      if (phase === 'ready' && request === 'SIGINT') {
        await withTimeout(cleanupStarted.promise, () => output)
        requestShutdown(child, 'SIGTERM')
        if (process.platform !== 'win32') {
          child.send('repeat-requested')
        }
      }
      const result = await withTimeout(finished.promise, () => output)
      expect(result, output).toEqual({ code: request === 'SIGINT' ? 130 : request === 'SIGTERM' ? 143 : 0, signal: null })
      expect(await readFile(path.join(root, 'shutdown-events.txt'), 'utf8')).toBe('cleanup-start\ncleanup-finished\n')
      await expect(access(lease)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(path.join(root, 'project.private.config.json'), 'utf8')).toBe(privateConfig)
      for (const file of ['app.js', 'pages/index/index.js', 'pages/index/index.json', 'pages/index/index.wxml']) {
        await expect(access(path.join(root, 'dist', file))).resolves.toBeUndefined()
      }
    }
    finally {
      try {
        if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL')
          await withTimeout(finished.promise, () => output, 5_000)
        }
      }
      finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  }, 45_000)
})
