import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { expect, it } from 'vitest'

it.each(['disconnect', 'reset', 'close-failure', 'normal', 'listen', 'watch'] as const)('drains native resources and reports %s through its real process exit', async (outcome) => {
  const token = randomUUID()
  const sockets = new Set<import('node:net').Socket>()
  const messages: Array<{ type: string, token: string, error?: string }> = []
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
    const input = createInterface({ input: socket })
    input.on('line', (line) => {
      const message = JSON.parse(line) as { type: string, token: string, error?: string }
      messages.push(message)
      if (message.type !== (outcome === 'listen' || outcome === 'watch' ? 'initial-started' : 'ready')) {
        return
      }
      if (outcome === 'disconnect') {
        socket.end()
      }
      else if (outcome === 'reset') {
        socket.resetAndDestroy()
      }
      else {
        socket.write(`${JSON.stringify({ type: 'close', token })}\n`)
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Native host control probe requires a TCP listener')
  }
  const endpoint = { port: address.port, token }
  const child = spawn(process.execPath, ['--input-type=module', '--eval', `
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { createNativeHostControlPlugin } from ${JSON.stringify(new URL('./plugin.mjs', import.meta.url).href)}
const active = setInterval(() => {}, 1000)
const plugin = createNativeHostControlPlugin(${JSON.stringify(endpoint)})
const close = async () => {
  clearInterval(active)
  await delay(20)
  console.log('owned-native-resource-closed')
  console.error('native-final-output')
  ${outcome === 'close-failure' ? 'throw new Error("original-native-close-failure")' : ''}
}
if (${JSON.stringify(outcome)} === 'listen') {
  const server = { close, listen: async () => undefined }
  await plugin.configureServer.handler(server)
  await server.listen()
  await server.listen()
}
else if (${JSON.stringify(outcome)} === 'watch') {
  const watcher = { close }
  const builder = { build: async () => watcher }
  plugin.buildApp.handler(builder)
  await builder.build({ config: { build: { watch: true } } })
  await builder.build({ config: { build: { watch: true } } })
}
else {
  await plugin.configureServer.handler({ close })
}
process.once('exit', code => console.log('native-process-exit=' + code))
`], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => stdout += String(chunk))
  child.stderr.on('data', chunk => stderr += String(chunk))
  try {
    const [code, signal] = await once(child, 'close', { signal: AbortSignal.timeout(5_000) })
    expect(signal).toBeNull()
    expect(code).toBe(['normal', 'listen', 'watch'].includes(outcome) ? 0 : 1)
    expect(stdout).toContain('owned-native-resource-closed')
    expect(stdout).toContain(`native-process-exit=${code}`)
    expect(stderr).toContain('native-final-output')
    expect(messages.filter(message => message.type === 'ready')).toHaveLength(1)
    if (outcome === 'listen' || outcome === 'watch') {
      expect(messages.filter(message => message.type === 'initial-started')).toHaveLength(1)
    }
    if (outcome === 'disconnect' || outcome === 'reset') {
      expect(stderr).toContain('Control connection failed:')
      if (outcome === 'disconnect') {
        expect(stderr).toContain('Control disconnected before native cleanup completed')
      }
      else {
        expect(stderr).toMatch(/ECONNRESET|EPIPE|Control disconnected before native cleanup completed/)
      }
      expect(messages.some(message => message.type === 'closed')).toBe(false)
    }
    else {
      expect(messages.find(message => message.type === 'closed')).toEqual({
        type: 'closed',
        token,
        ...outcome === 'close-failure' ? { error: 'original-native-close-failure' } : {},
      })
    }
  }
  finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'close')
    }
    for (const socket of sockets) {
      socket.destroy()
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}, 10_000)
