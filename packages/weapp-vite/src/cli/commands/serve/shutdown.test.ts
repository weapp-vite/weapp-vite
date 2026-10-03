import { spawn } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'
import { expect, it } from 'vitest'

it.each(['waiting', 'starting'] as const)('finishes serve cleanup when its Node IPC parent disconnects while %s', async (phase) => {
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { waitForServeShutdownSignal } from ${JSON.stringify(new URL('./shared.ts', import.meta.url).href)};
    const stopped = ${phase === 'waiting'
      ? 'waitForServeShutdownSignal()'
      : 'new Promise(resolve => process.once("disconnect", resolve)).then(() => waitForServeShutdownSignal())'};
    process.send('ready');
    await stopped;
    await new Promise(resolve => setTimeout(resolve, 25));
    console.log('provider-disposed');
  `], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  let output = ''
  child.stdout.on('data', chunk => output += String(chunk))
  child.stderr.on('data', chunk => output += String(chunk))
  const exited = once(child, 'exit')
  try {
    expect(await once(child, 'message')).toEqual(['ready', undefined])
    child.disconnect()
    expect(await exited).toEqual([0, null])
    expect(output).toContain('provider-disposed')
  }
  finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await exited
    }
  }
}, 10_000)
