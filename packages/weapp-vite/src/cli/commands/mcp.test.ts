import { cac } from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const startWeappViteMcpServerMock = vi.hoisted(() => vi.fn())
const buildMcpClientConfigPlanMock = vi.hoisted(() => vi.fn())
const writeMcpClientConfigMock = vi.hoisted(() => vi.fn())
const inspectMcpClientConfigMock = vi.hoisted(() => vi.fn())
const loggerInfoMock = vi.hoisted(() => vi.fn())
const loggerSuccessMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const runWithSuspendedSharedInputMock = vi.hoisted(() => vi.fn())
const createInterfaceMock = vi.hoisted(() => vi.fn())

vi.mock('../../mcp', () => ({
  startWeappViteMcpServer: startWeappViteMcpServerMock,
  resolveWeappMcpConfig: vi.fn(() => ({
    enabled: true,
    autoStart: false,
    endpoint: '/mcp',
    host: '127.0.0.1',
    port: 3088,
    restEndpoint: '/api/weapp/devtools',
  })),
}))

vi.mock('weapp-ide-cli', () => ({
  runWithSuspendedSharedInput: runWithSuspendedSharedInputMock,
}))

vi.mock('node:readline/promises', () => ({
  createInterface: createInterfaceMock,
}))

vi.mock('../../logger', () => ({
  default: {
    info: loggerInfoMock,
    success: loggerSuccessMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('../mcpClient', () => ({
  buildMcpClientConfigPlan: buildMcpClientConfigPlanMock,
  formatMcpQuickStart: vi.fn(() => ['hint line']),
  inspectMcpClientConfig: inspectMcpClientConfigMock,
  resolveSupportedMcpClient: vi.fn((value: string) => value),
  writeMcpClientConfig: writeMcpClientConfigMock,
}))

vi.mock('../loadConfig', () => ({
  loadConfig: vi.fn().mockResolvedValue(undefined),
}))

describe('mcp cli command', () => {
  beforeEach(() => {
    startWeappViteMcpServerMock.mockReset()
    buildMcpClientConfigPlanMock.mockReset()
    writeMcpClientConfigMock.mockReset()
    inspectMcpClientConfigMock.mockReset()
    runWithSuspendedSharedInputMock.mockReset()
    createInterfaceMock.mockReset()
    loggerInfoMock.mockReset()
    loggerSuccessMock.mockReset()
    loggerWarnMock.mockReset()
    startWeappViteMcpServerMock.mockResolvedValue(undefined)
    buildMcpClientConfigPlanMock.mockReturnValue({
      preview: '{ "mcpServers": {} }',
      target: {
        configPath: '/project/.mcp.json',
        displayName: 'Claude Code',
        serverName: 'weapp-vite-project',
      },
    })
    writeMcpClientConfigMock.mockResolvedValue(undefined)
    inspectMcpClientConfigMock.mockResolvedValue({
      configExists: true,
      configPath: '/project/.mcp.json',
      displayName: 'Claude Code',
      issues: [],
      serverName: 'weapp-vite-project',
      transport: 'command',
    })
    runWithSuspendedSharedInputMock.mockImplementation(async (runner: () => Promise<unknown>) => await runner())
    createInterfaceMock.mockReturnValue({
      close: vi.fn(),
      question: vi.fn().mockResolvedValue('y'),
    })
  })

  it('starts mcp server with auto workspace root by default', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp'], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: undefined,
      host: undefined,
      port: undefined,
      restEndpoint: undefined,
      transport: 'stdio',
      unref: undefined,
      workspaceRoot: undefined,
    })
  })

  it('starts mcp server with explicit workspace root', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp', '--workspace-root', './packages/weapp-vite'], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: undefined,
      host: undefined,
      port: undefined,
      restEndpoint: undefined,
      transport: 'stdio',
      unref: undefined,
      workspaceRoot: './packages/weapp-vite',
    })
  })

  it('supports streamable-http options', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse([
      'node',
      'weapp-vite',
      'mcp',
      '--transport',
      'streamable-http',
      '--host',
      '0.0.0.0',
      '--port',
      '3199',
      '--endpoint',
      '/mcp',
    ], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith({
      endpoint: '/mcp',
      host: '0.0.0.0',
      port: 3199,
      restEndpoint: undefined,
      transport: 'streamable-http',
      unref: undefined,
      workspaceRoot: undefined,
    })
    expect(loggerInfoMock).toHaveBeenCalledWith('hint line')
  })

  it('supports REST endpoint options', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse([
      'node',
      'weapp-vite',
      'mcp',
      '--transport',
      'http',
      '--rest-endpoint',
      '/api/runtime',
    ], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      restEndpoint: '/api/runtime',
      transport: 'streamable-http',
    }))
  })

  it('can disable REST runtime endpoints', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse([
      'node',
      'weapp-vite',
      'mcp',
      '--transport',
      'http',
      '--no-rest',
    ], { run: false })
    await cli.runMatchedCommand()

    expect(startWeappViteMcpServerMock).toHaveBeenCalledWith(expect.objectContaining({
      restEndpoint: false,
      transport: 'streamable-http',
    }))
  })

  it('writes client config for init command', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp', 'init', 'claude-code', '--yes'], { run: false })
    await cli.runMatchedCommand()

    expect(buildMcpClientConfigPlanMock).toHaveBeenCalledWith(expect.objectContaining({
      client: 'claude-code',
      transport: 'command',
    }))
    expect(writeMcpClientConfigMock).toHaveBeenCalled()
  })

  it('prompts before writing client config when --yes is not provided', async () => {
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true })

    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    try {
      cli.parse(['node', 'weapp-vite', 'mcp', 'init', 'claude-code'], { run: false })
      await cli.runMatchedCommand()

      expect(runWithSuspendedSharedInputMock).toHaveBeenCalledTimes(1)
      expect(createInterfaceMock).toHaveBeenCalledTimes(1)
      expect(writeMcpClientConfigMock).toHaveBeenCalledTimes(1)
    }
    finally {
      if (stdinDescriptor) {
        Object.defineProperty(process.stdin, 'isTTY', stdinDescriptor)
      }
      if (stdoutDescriptor) {
        Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor)
      }
    }
  })

  it('runs doctor command and reports success', async () => {
    const { registerMcpCommand } = await import('./mcp')
    const cli = cac('weapp-vite')
    registerMcpCommand(cli)

    cli.parse(['node', 'weapp-vite', 'mcp', 'doctor', 'cursor'], { run: false })
    await cli.runMatchedCommand()

    expect(inspectMcpClientConfigMock).toHaveBeenCalledWith({
      client: 'cursor',
      workspaceRoot: process.cwd(),
    })
    expect(loggerSuccessMock).toHaveBeenCalledWith('MCP 客户端配置检查通过。')
  })
})
