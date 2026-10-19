import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { expect, it } from 'vitest'
import { BUN_EXECUTABLE } from '../utils/bunProject'

it.each(['waiting', 'starting'] as const)('drains Bun cleanup when IPC disconnects while %s', async (phase) => {
  // Bun 是原生可执行文件；直接 spawn 便于验证真实 IPC 事件，不经过平台 shell。
  const child = spawn(BUN_EXECUTABLE, ['-e', `
    import { createDevShutdownScope } from ${JSON.stringify(new URL('../../packages/weapp-vite/src/devLifecycle/shutdown.ts', import.meta.url).href)};
    const initialize = async () => {
      const scope = createDevShutdownScope();
      console.log('initial-stopping:' + scope.stopping);
      await scope.run('startup', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        scope.own(async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
          console.log('provider-disposed');
        });
      });
      return scope;
    };
    const scopeReady = ${phase === 'waiting'
      ? 'initialize()'
      : 'new Promise(resolve => process.once("disconnect", resolve)).then(initialize)'};
    process.send('ready');
    const scope = await scopeReady;
    await scope.signal;
    await scope.close();
  `], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  let output = ''
  const exited = once(child, 'exit')
  try {
    if (!child.stdout || !child.stderr) {
      throw new Error('Bun IPC child must expose the configured stdout and stderr pipes')
    }
    child.stdout.on('data', chunk => output += String(chunk))
    child.stderr.on('data', chunk => output += String(chunk))
    expect(await once(child, 'message', { signal: AbortSignal.timeout(10_000) })).toEqual(['ready', undefined])
    child.disconnect()
    expect(await Promise.race([
      exited,
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Bun IPC shutdown timed out: ${output}`)), 10_000)
        timer.unref()
        void exited.finally(() => clearTimeout(timer))
      }),
    ]), output).toEqual([0, null])
    expect(output).toContain(`initial-stopping:${phase === 'starting'}`)
    expect(output).toContain('provider-disposed')
  }
  finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await exited
    }
  }
}, 20_000)
