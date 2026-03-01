import { describe, expect, it } from 'vitest'
import { DEFAULT_MCP_ENDPOINT, DEFAULT_MCP_PORT, resolveWeappMcpConfig } from './mcp'

describe('weapp mcp config', () => {
  it('disables mcp when config is false', () => {
    const resolved = resolveWeappMcpConfig(false)

    expect(resolved.enabled).toBe(false)
    expect(resolved.autoStart).toBe(false)
  })

  it('uses defaults when config is omitted', () => {
    const resolved = resolveWeappMcpConfig(undefined)

    expect(resolved.enabled).toBe(true)
    expect(resolved.autoStart).toBe(true)
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
  })

  it('normalizes endpoint and port', () => {
    const resolved = resolveWeappMcpConfig({
      endpoint: 'my-mcp',
      port: -1,
    })

    expect(resolved.endpoint).toBe('/my-mcp')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })
})
