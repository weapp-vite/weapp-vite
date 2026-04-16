import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMcpClientConfigPlan,
  formatMcpQuickStart,
  inspectMcpClientConfig,
  resolveSupportedMcpClient,
  writeMcpClientConfig,
} from './mcpClient'

describe('mcp client onboarding', () => {
  const workspaceFolderToken = '${' + 'workspaceFolder}'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds codex command config with managed toml block', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/tmp/tester-home')

    const plan = buildMcpClientConfigPlan({
      client: 'codex',
      transport: 'command',
      workspaceRoot: '/workspace/demo-app',
    })

    expect(plan.target.configPath).toBe('/tmp/tester-home/.codex/config.toml')
    expect(plan.target.serverName).toBe('weapp-vite-demo-app')
    expect(plan.preview).toContain('[mcp_servers.weapp-vite-demo-app]')
    expect(plan.preview).toContain('/workspace/demo-app/node_modules/weapp-vite/bin/weapp-vite.js')
  })

  it('writes claude config by merging mcpServers entries', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-mcp-claude-'))
    const configPath = path.join(root, '.mcp.json')

    await fs.writeFile(configPath, `${JSON.stringify({
      mcpServers: {
        existing: {
          command: 'node',
          args: ['server.js'],
        },
      },
    }, null, 2)}\n`, 'utf8')

    const plan = buildMcpClientConfigPlan({
      client: 'claude-code',
      transport: 'command',
      workspaceRoot: root,
    })
    await writeMcpClientConfig(plan)

    const written = await fs.readJSON(configPath)
    expect(written.mcpServers.existing).toBeDefined()
    expect(written.mcpServers[plan.target.serverName].args[0]).toBe(
      path.join(root, 'node_modules', 'weapp-vite', 'bin', 'weapp-vite.js'),
    )
  })

  it('upserts codex config block without duplicating the managed section', async () => {
    const homeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-mcp-codex-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(homeRoot)
    const codexConfigDir = path.join(homeRoot, '.codex')
    const codexConfigPath = path.join(codexConfigDir, 'config.toml')

    await fs.ensureDir(codexConfigDir)

    const firstPlan = buildMcpClientConfigPlan({
      client: 'codex',
      transport: 'command',
      workspaceRoot: '/workspace/demo-app',
    })
    await writeMcpClientConfig(firstPlan)

    const secondPlan = buildMcpClientConfigPlan({
      client: 'codex',
      transport: 'http',
      url: 'http://127.0.0.1:3088/mcp',
      workspaceRoot: '/workspace/demo-app',
    })
    await writeMcpClientConfig(secondPlan)

    const content = await fs.readFile(codexConfigPath, 'utf8')
    expect(content.match(/# >>> weapp-vite mcp weapp-vite-demo-app >>>/g)).toHaveLength(1)
    expect(content).toContain('url = "http://127.0.0.1:3088/mcp"')
    expect(content).not.toContain('command = ')
  })

  it('inspects cursor command config against the workspace root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-mcp-cursor-'))
    const binPath = path.join(root, 'node_modules', 'weapp-vite', 'bin', 'weapp-vite.js')
    const configPath = path.join(root, '.cursor', 'mcp.json')
    const plan = buildMcpClientConfigPlan({
      client: 'cursor',
      transport: 'command',
      workspaceRoot: root,
    })

    await fs.ensureDir(path.dirname(binPath))
    await fs.writeFile(binPath, '#!/usr/bin/env node\n', 'utf8')
    await fs.ensureDir(path.dirname(configPath))
    await fs.writeFile(configPath, `${JSON.stringify({
      mcpServers: {
        [plan.target.serverName]: {
          command: 'node',
          args: [
            `${workspaceFolderToken}/node_modules/weapp-vite/bin/weapp-vite.js`,
            'mcp',
            '--workspace-root',
            workspaceFolderToken,
          ],
        },
      },
    }, null, 2)}\n`, 'utf8')

    const result = await inspectMcpClientConfig({
      client: 'cursor',
      workspaceRoot: root,
    })

    expect(result.issues).toEqual([])
    expect(result.transport).toBe('command')
  })

  it('formats quick start commands for http mode', () => {
    expect(formatMcpQuickStart({
      httpUrl: 'http://127.0.0.1:3088/mcp',
      transport: 'http',
    })).toEqual([
      '在 AI 工具中接入 weapp-vite MCP：',
      '  - Codex: wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp',
      '  - Claude Code: wv mcp init claude-code --transport http --url http://127.0.0.1:3088/mcp',
      '  - Cursor: wv mcp init cursor --transport http --url http://127.0.0.1:3088/mcp',
    ])
  })

  it('rejects unsupported clients', () => {
    expect(() => resolveSupportedMcpClient('windsurf')).toThrow(/不支持的 MCP 客户端/)
  })
})
