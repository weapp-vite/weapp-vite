import { expect, it, vi } from 'vitest'
import { startWeappIdeMcpServer } from '../src/mcp/runtime'
import { createWeappIdeMcpServer, registerWeappIdeMcpTools } from '../src/mcp/server'

const state = vi.hoisted(() => ({ serverLoaded: false, stdioLoaded: false, close: vi.fn() }))

vi.mock('@modelcontextprotocol/server', () => {
  state.serverLoaded = true
  return { McpServer: class {
    registerTool = vi.fn()
  } }
})

vi.mock('@modelcontextprotocol/server/stdio', () => {
  state.stdioLoaded = true
  return { serveStdio: () => ({ close: state.close }) }
})

it('keeps SDK loading out of imports and tool registration until its service is requested', async () => {
  const options = { runtimeHooks: { withMiniProgram: vi.fn() } }
  const registerTool = vi.fn()
  expect(state.serverLoaded).toBe(false)
  expect(state.stdioLoaded).toBe(false)
  registerWeappIdeMcpTools({ registerTool }, options)
  expect(registerTool).toHaveBeenCalled()
  expect(state.serverLoaded).toBe(false)
  expect(state.stdioLoaded).toBe(false)

  const { server } = await createWeappIdeMcpServer(options)
  expect(server.registerTool).toHaveBeenCalled()
  expect(state.serverLoaded).toBe(true)
  expect(state.stdioLoaded).toBe(false)

  const handle = await startWeappIdeMcpServer()
  expect(state.stdioLoaded).toBe(true)
  await handle.close()
  expect(state.close).toHaveBeenCalledOnce()
})
