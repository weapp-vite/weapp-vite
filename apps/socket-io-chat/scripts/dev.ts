import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

interface DevTask {
  name: string
  command: string
  args: string[]
  env?: NodeJS.ProcessEnv
}

const appRoot = path.resolve(fileURLToPath(import.meta.url), '../..')
const webHost = '127.0.0.1'
const children: ChildProcess[] = []
let isShuttingDown = false

function getServerUrl(port: number) {
  return `http://127.0.0.1:${port}`
}

function printUrls(serverUrl: string, webBaseUrl: string) {
  console.log('')
  console.log('[socket-io-chat] dev started')
  console.log(`[socket-io-chat] server: ${serverUrl}`)
  console.log(`[socket-io-chat] web: ${webBaseUrl}/`)
  console.log(`[socket-io-chat] web chat: ${webBaseUrl}/chat`)
  console.log(`[socket-io-chat] web axios: ${webBaseUrl}/axios`)
  console.log(`[socket-io-chat] web fetch: ${webBaseUrl}/fetch`)
  console.log(`[socket-io-chat] web graphql: ${webBaseUrl}/graphql`)
  console.log('')
}

function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

function resolveCommand(command: string) {
  return process.platform === 'win32' ? `${command}.cmd` : command
}

function isPortAvailable(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, host)
  })
}

async function findAvailablePort(startPort: number, host: string) {
  let port = startPort

  while (!(await isPortAvailable(port, host))) {
    port += 1
  }

  return port
}

const serverPort = await findAvailablePort(Number.parseInt(process.env.PORT ?? '3001', 10), '0.0.0.0')
const webPort = await findAvailablePort(Number.parseInt(process.env.WEB_PORT ?? '5174', 10), webHost)
const serverUrl = getServerUrl(serverPort)
const webBaseUrl = `http://${webHost}:${webPort}`
const sharedEnv = {
  ...process.env,
  PORT: String(serverPort),
  VITE_API_URL: process.env.VITE_API_URL ?? serverUrl,
  VITE_SOCKET_URL: process.env.VITE_SOCKET_URL ?? serverUrl,
}

const tasks: DevTask[] = [
  {
    name: 'server',
    command: 'tsx',
    args: ['server/index.ts'],
    env: sharedEnv,
  },
  {
    name: 'web',
    command: 'vite',
    args: ['--host', webHost, '--port', String(webPort), '--strictPort', 'web'],
    env: sharedEnv,
  },
]

printUrls(serverUrl, webBaseUrl)

for (const task of tasks) {
  const child = spawn(resolveCommand(task.command), task.args, {
    cwd: appRoot,
    env: task.env ?? process.env,
    stdio: 'inherit',
  })

  children.push(child)

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      return
    }

    if (code === 0 || signal) {
      return
    }

    console.error(`[socket-io-chat] ${task.name} exited with code ${code}`)
    shutdown('SIGTERM')
  })

  child.on('error', (error) => {
    if (isShuttingDown) {
      return
    }

    console.error(`[socket-io-chat] ${task.name} failed to start`, error)
    shutdown('SIGTERM')
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('exit', () => {
  isShuttingDown = true
})
