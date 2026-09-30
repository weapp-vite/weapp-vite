import type { AcceptanceService } from './acceptance.js'

import process from 'node:process'

import { McpServer } from '@modelcontextprotocol/server'

import { serveStdio } from '@modelcontextprotocol/server/stdio'

import { registerAcceptanceTools } from '@weapp-vite/mcp'

export function createAcceptanceMcpServer(service: AcceptanceService): McpServer {
  const server = new McpServer({ name: 'weapp-agent', version: '0.1.0-preview.1' })

  registerAcceptanceTools(server, async () => service)

  return server
}

export async function serveAcceptanceMcp(service: AcceptanceService) {
  const server = createAcceptanceMcpServer(service)

  const handle = serveStdio(() => server)

  const close = async () => {
    await service.close()

    await handle.close()
  }

  process.stdin.once('end', () => {
    void close()
  })

  return { close }
}
