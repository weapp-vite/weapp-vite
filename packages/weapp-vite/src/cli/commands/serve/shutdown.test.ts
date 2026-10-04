import { spawn } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'
import { expect, it } from 'vitest'

it.each(['waiting', 'starting'] as const)('finishes serve cleanup when its Node IPC parent disconnects while %s', async (phase) => {
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { createDevShutdownScope } from ${JSON.stringify(new URL('../../../devLifecycle/shutdown.ts', import.meta.url).href)};
    const initialize = async () => {
      const scope = createDevShutdownScope();
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
  child.stdout.on('data', chunk => output += String(chunk))
  child.stderr.on('data', chunk => output += String(chunk))
  const exited = once(child, 'exit')
  try {
    expect(await once(child, 'message')).toEqual(['ready', undefined])
    child.disconnect()
    expect(await exited, output).toEqual([0, null])
    expect(output).toContain('provider-disposed')
  }
  finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await exited
    }
  }
}, 10_000)
