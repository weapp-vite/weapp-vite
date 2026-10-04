import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RuntimeSessionManager } from '../src/server/runtime/shared'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { handleRuntimeRestRequest } from '../src/server/runtime/rest'
import { connectionInputSchema, connectionSchema } from '../src/server/runtime/shared'

function createHarness() {
  const manager = {
    withPage: vi.fn().mockResolvedValue({ path: 'pages/index/index' }),
    withMiniProgram: vi.fn().mockResolvedValue({ connected: true }),
  }
  async function request(method: string, url: string, body?: unknown) {
    const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), { method, url, headers: {} })
    const res = { headersSent: false, statusCode: 0, setHeader: vi.fn(), end: vi.fn() }
    await handleRuntimeRestRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse, {
      endpoint: '/runtime',
      manager: manager as unknown as RuntimeSessionManager,
    })
    return res
  }
  return { manager, request }
}

describe('runtime connection input selection', () => {
  it.each(['0', '-1', 'NaN', 'Infinity', '1.5', '22001junk', '65536', '', '1e3', '0x50'])('rejects explicit invalid REST query port %j without connecting', async (port) => {
    const { manager, request } = createHarness()
    const response = await request('GET', `/runtime/active-page?projectPath=project&port=${encodeURIComponent(port)}`)
    expect(response.statusCode).toBe(400)
    expect(manager.withPage).not.toHaveBeenCalled()
  })

  it('forwards the selected installation and boundary ports for REST query and body', async () => {
    const { manager, request } = createHarness()
    const queryResponse = await request('GET', '/runtime/active-page?projectPath=project&cliPath=stable-cli&port=1')
    expect(queryResponse.statusCode).toBe(200)
    expect(manager.withPage).toHaveBeenCalledWith(expect.objectContaining({ projectPath: 'project', cliPath: 'stable-cli', port: 1 }), expect.any(Function))
    const bodyResponse = await request('POST', '/runtime/connect', { projectPath: 'project', cliPath: 'stable-cli', port: 65535 })
    expect(bodyResponse.statusCode).toBe(200)
    expect(manager.withMiniProgram).toHaveBeenCalledWith(expect.objectContaining({ projectPath: 'project', cliPath: 'stable-cli', port: 65535 }), expect.any(Function))
  })

  it('rejects an out-of-range REST body port before using the manager', async () => {
    const { manager, request } = createHarness()
    expect((await request('POST', '/runtime/connect', { projectPath: 'project', port: 65536 })).statusCode).toBe(400)
    expect(manager.withMiniProgram).not.toHaveBeenCalled()
  })

  it.each([connectionSchema, z.object(connectionInputSchema)])('keeps MCP connection schemas within the TCP port range', (schema) => {
    expect(schema.safeParse({ projectPath: 'project', port: 65536 }).success).toBe(false)
    expect(schema.safeParse({ projectPath: 'project', port: 65535 }).success).toBe(true)
  })
})
