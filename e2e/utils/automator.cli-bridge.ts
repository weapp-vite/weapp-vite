import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import automator from 'miniprogram-automator'

interface AutomatorCliBridgePayload {
  projectPath?: string
  cliPath?: string
  cwd?: string
  timeout?: number
  trustProject?: boolean
  args?: string[]
  projectConfig?: Record<string, any>
}

interface AutomatorCliBridgeResult {
  wsEndpoint: string
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function readJsonObject(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : undefined
  }
  catch {
    return undefined
  }
}

function mergeProjectConfig(base: Record<string, any>, patch: Record<string, any>) {
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      base[key] = value.slice()
      continue
    }
    if (value && typeof value === 'object') {
      const current = base[key]
      base[key] = mergeProjectConfig(
        current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {},
        value as Record<string, any>,
      )
      continue
    }
    base[key] = value
  }
  return base
}

function resolveCliPath(cliPath?: string) {
  if (cliPath?.trim()) {
    return cliPath
  }
  if (process.platform === 'win32') {
    return 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  }
  return '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
}

async function reserveLoopbackPort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function connectWithRetry(wsEndpoint: string, timeoutMs: number) {
  const startedAt = Date.now()
  let lastError: unknown
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const miniProgram = await (automator as typeof automator & {
        connect: (options: { wsEndpoint: string }) => Promise<any>
      }).connect({ wsEndpoint })
      await miniProgram.close()
      return
    }
    catch (error) {
      lastError = error
      await sleep(400)
    }
  }
  throw new Error(`Timed out waiting for automator websocket ${wsEndpoint}`, {
    cause: lastError as Error,
  })
}

async function extendProjectConfig(projectPath: string, projectConfig?: Record<string, any>) {
  if (!projectConfig || Object.keys(projectConfig).length === 0) {
    return
  }

  const configPath = path.resolve(projectPath, 'project.config.json')
  const current = readJsonObject(configPath)
  if (!current) {
    throw new Error(`Failed to read project config: ${configPath}`)
  }

  const next = mergeProjectConfig({ ...current }, projectConfig)
  fs.writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
}

async function main() {
  const rawPayload = process.argv[2]
  if (!rawPayload) {
    throw new Error('Missing automator cli bridge payload')
  }

  const payload = JSON.parse(rawPayload) as AutomatorCliBridgePayload
  const projectPath = payload.projectPath
  if (!projectPath) {
    throw new Error('Missing projectPath for automator cli bridge')
  }

  await extendProjectConfig(projectPath, payload.projectConfig)
  const autoPort = await reserveLoopbackPort()
  const cliPath = resolveCliPath(payload.cliPath)
  const args = [
    'auto',
    '--project',
    projectPath,
    '--auto-port',
    String(autoPort),
    ...(payload.args || []),
  ]
  if (payload.trustProject) {
    args.push('--trust-project')
  }

  const child = spawn(cliPath, args, {
    cwd: payload.cwd,
    stdio: 'ignore',
    detached: false,
  })
  child.unref()

  const wsEndpoint = `ws://127.0.0.1:${autoPort}`
  await connectWithRetry(wsEndpoint, payload.timeout ?? 30_000)

  const result: AutomatorCliBridgeResult = { wsEndpoint }
  process.stdout.write(JSON.stringify(result))
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
