import type { AddressInfo } from 'node:net'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { afterEach, describe, expect, it } from 'vitest'
import { startWeappViteMcpServer } from '@/runtime'
import { resolveWorkspaceRoot } from '@/workspace'

const workspaceRoot = resolveWorkspaceRoot(path.resolve(import.meta.dirname, '../..'))
const stdioServerFixture = path.resolve(import.meta.dirname, 'stdioServerFixture.ts')
const protocolVersions = ['2026-07-28', '2025-11-25', '2025-03-26'] as const

type ProtocolVersion = typeof protocolVersions[number]

interface ProtocolHarness {
  client: Client
  close: () => Promise<void>
}

const openHarnesses = new Set<ProtocolHarness>()

function createClient(protocolVersion: ProtocolVersion) {
  const modern = protocolVersion === '2026-07-28'
  return new Client({
    name: '@weapp-vite/mcp-protocol-integration-test',
    version: '1.0.0',
  }, modern
    ? {
        versionNegotiation: {
          mode: { pin: protocolVersion },
        },
      }
    : {
        supportedProtocolVersions: [protocolVersion],
        versionNegotiation: {
          mode: 'legacy',
        },
      })
}

async function reserveLoopbackPort() {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
  return address.port
}

async function isLoopbackPortListening(port: number) {
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(1000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function trackHarness(harness: ProtocolHarness) {
  openHarnesses.add(harness)
  return harness
}

async function createHttpHarness(protocolVersion: ProtocolVersion) {
  const port = await reserveLoopbackPort()
  const server = await startWeappViteMcpServer({
    host: '127.0.0.1',
    port,
    quiet: true,
    restEndpoint: false,
    transport: 'streamable-http',
    workspaceRoot,
  })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`))
  const client = createClient(protocolVersion)
  try {
    await client.connect(transport)
  }
  catch (error) {
    await client.close().catch(() => {})
    await server.close?.()
    throw error
  }

  const harness: ProtocolHarness = {
    client,
    close: async () => {
      openHarnesses.delete(harness)
      try {
        await client.close()
      }
      finally {
        await server.close?.()
      }
      expect(await isLoopbackPortListening(port)).toBe(false)
    },
  }
  return trackHarness(harness)
}

async function createStdioHarness(protocolVersion: ProtocolVersion) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', stdioServerFixture],
    cwd: workspaceRoot,
    stderr: 'pipe',
  })
  const client = createClient(protocolVersion)
  try {
    await client.connect(transport)
  }
  catch (error) {
    await client.close().catch(() => {})
    throw error
  }

  const harness: ProtocolHarness = {
    client,
    close: async () => {
      openHarnesses.delete(harness)
      await client.close()
      expect(transport.pid).toBeNull()
    },
  }
  return trackHarness(harness)
}

async function expectProtocolContract(client: Client, protocolVersion: ProtocolVersion) {
  expect(client.getNegotiatedProtocolVersion()).toBe(protocolVersion)
  expect(client.getProtocolEra()).toBe(protocolVersion === '2026-07-28' ? 'modern' : 'legacy')

  const [{ tools }, { resources }, { prompts }] = await Promise.all([
    client.listTools(),
    client.listResources(),
    client.listPrompts(),
  ])
  expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
    'workspace_catalog',
    'read_source_file',
    'weapp_devtools_connect',
    'weapp_runtime_find_node_by_xpath',
  ]))
  expect(resources.map(resource => resource.uri)).toContain('weapp-vite://workspace/catalog')
  expect(prompts.map(prompt => prompt.name)).toEqual(expect.arrayContaining([
    'plan-weapp-vite-change',
    'inspect-mini-program-page',
  ]))

  const catalog = await client.callTool({
    name: 'workspace_catalog',
    arguments: {},
  })
  expect(catalog.isError).not.toBe(true)
  expect(catalog.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'text' }),
  ]))

  const resource = await client.readResource({
    uri: 'weapp-vite://workspace/catalog',
  })
  expect(resource.contents).toEqual(expect.arrayContaining([
    expect.objectContaining({
      mimeType: 'application/json',
      uri: 'weapp-vite://workspace/catalog',
    }),
  ]))

  const prompt = await client.getPrompt({
    name: 'plan-weapp-vite-change',
    arguments: {
      objective: '验证 MCP 协议',
    },
  })
  expect(prompt.messages).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: 'user' }),
  ]))
}

afterEach(async () => {
  await Promise.all([...openHarnesses].map(harness => harness.close()))
})

describe.each([
  ['stdio', createStdioHarness],
  ['streamable-http', createHttpHarness],
] as const)('MCP protocol integration over %s', (_transport, createHarness) => {
  it.each(protocolVersions)('supports protocol %s', async (protocolVersion) => {
    const harness = await createHarness(protocolVersion)
    await expectProtocolContract(harness.client, protocolVersion)
    await harness.close()
  })
})
