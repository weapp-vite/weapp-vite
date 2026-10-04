import assert from 'node:assert/strict'
import net from 'node:net'
import { setTimeout } from 'node:timers/promises'
// eslint-disable-next-line e18e/ban-dependencies -- 精确项目关闭复用跨平台 CLI 封装。
import { execa } from 'execa'

export interface BenchSessionResource {
  id: string
  projectPath: string
  cliPath: string
  wsEndpoint?: string
  port?: number
  status: 'owned' | 'closing' | 'closed' | 'failed'
  projectClosed: boolean
  portClosed: boolean | null
}

function probePortClosed(port: number, host: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    const finish = (error?: Error, closed = false) => {
      socket.destroy()
      if (error) {
        reject(error)
      }
      else {
        resolve(closed)
      }
    }
    socket.once('connect', () => finish())
    socket.once('error', (error: NodeJS.ErrnoException) => error.code === 'ECONNREFUSED' ? finish(undefined, true) : finish(error))
    socket.setTimeout(1_000, () => finish(new Error('Timed out checking benchmark automator port')))
  })
}

export async function waitForBenchPortClosed(port: number, host = '127.0.0.1', timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  do {
    if (await probePortClosed(port, host)) {
      return
    }
    await setTimeout(100)
  } while (Date.now() < deadline)
  throw new Error('Benchmark automator port remained open after project close')
}

export async function closeBenchProject(resource: BenchSessionResource) {
  await execa(resource.cliPath, ['close', '--project', resource.projectPath], { timeout: 30_000 })
}

/** 仅接收启动器明确创建的快照；路径相似或 metadata 本身不授予关闭所有权。 */
export function createBenchResourceRegistry(options: {
  cliPath: string
  onResource?: (resource: BenchSessionResource) => Promise<void>
  closeProject?: typeof closeBenchProject
  waitForPortClosed?: typeof waitForBenchPortClosed
}) {
  const resources = new Map<string, BenchSessionResource>()
  const closers = new Map<string, Promise<void>>()
  const publish = async (resource: BenchSessionResource) => options.onResource?.({ ...resource })
  return {
    async ownProject(project: { projectPath: string, cliPath: string }) {
      assert.equal(project.cliPath, options.cliPath, 'Benchmark launcher selected a different DevTools CLI')
      assert(!resources.has(project.projectPath), 'Benchmark snapshot ownership was already registered')
      const resource: BenchSessionResource = {
        ...project,
        id: `session-${resources.size + 1}`,
        status: 'owned',
        projectClosed: false,
        portClosed: null,
      }
      resources.set(resource.projectPath, resource)
      await publish(resource)
    },
    async attachMetadata(metadata: unknown) {
      assert(metadata && typeof metadata === 'object', 'Missing benchmark session metadata')
      const value = metadata as Record<string, unknown>
      assert(typeof value.projectPath === 'string', 'Missing benchmark session project path')
      const resource = resources.get(value.projectPath)
      assert(resource && resource.status === 'owned', 'Benchmark session is not an owned snapshot')
      assert(typeof value.wsEndpoint === 'string', 'Missing benchmark session endpoint')
      assert(typeof value.port === 'number' && Number.isInteger(value.port) && value.port > 0 && value.port <= 65535, 'Invalid benchmark session port')
      const endpoint = new URL(value.wsEndpoint)
      assert(['ws:', 'wss:'].includes(endpoint.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Benchmark session endpoint must be loopback')
      assert.equal(Number(endpoint.port), value.port, 'Benchmark session endpoint and port differ')
      assert(!resource.wsEndpoint || resource.wsEndpoint === value.wsEndpoint, 'Benchmark snapshot endpoint changed')
      resource.wsEndpoint = value.wsEndpoint
      resource.port = value.port
      resource.portClosed = false
      await publish(resource)
    },
    async closeAll() {
      const errors: unknown[] = []
      for (const resource of resources.values()) {
        let closing = closers.get(resource.id)
        if (!closing) {
          closing = (async () => {
            const errors: unknown[] = []
            resource.status = 'closing'
            try {
              await publish(resource)
            }
            catch (error) {
              errors.push(error)
            }
            try {
              await (options.closeProject ?? closeBenchProject)(resource)
              resource.projectClosed = true
            }
            catch (error) {
              errors.push(error)
            }
            if (resource.port !== undefined) {
              try {
                const hostname = new URL(resource.wsEndpoint!).hostname.replace(/^\[|\]$/g, '')
                await (options.waitForPortClosed ?? waitForBenchPortClosed)(resource.port, hostname)
                resource.portClosed = true
              }
              catch (error) {
                errors.push(error)
              }
            }
            resource.status = errors.length ? 'failed' : 'closed'
            try {
              await publish(resource)
            }
            catch (error) {
              errors.push(error)
            }
            if (errors.length) {
              throw new AggregateError(errors, `Benchmark ${resource.id} resource cleanup failed`)
            }
          })()
          closers.set(resource.id, closing)
        }
        try {
          await closing
        }
        catch (error) {
          errors.push(error)
        }
      }
      if (errors.length) {
        throw new AggregateError(errors, 'Benchmark owned resource cleanup failed')
      }
    },
  }
}

/** 缺失或未核验的资源记录不能作为真实 IDE 验收通过证据。 */
export function assertBenchResourcesClosed(resources: BenchSessionResource[] | undefined) {
  assert(resources?.length, 'Missing benchmark owned resource evidence')
  for (const resource of resources) {
    assert(resource.projectPath && resource.cliPath && resource.wsEndpoint && Number.isInteger(resource.port), 'Incomplete benchmark owned resource metadata')
    assert(resource.status === 'closed' && resource.projectClosed && resource.portClosed === true, 'Benchmark owned project or port was not closed')
  }
}
