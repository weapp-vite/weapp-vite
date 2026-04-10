export type SupportedMcpClient = 'codex' | 'claude-code' | 'cursor'
export type McpClientTransport = 'command' | 'http'

export interface JsonMcpServerEntry {
  args?: string[]
  command?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  type?: string
  url?: string
}

export interface JsonMcpConfigFile {
  mcpServers?: Record<string, JsonMcpServerEntry>
}

export interface McpClientConfigEntry {
  args?: string[]
  command?: string
  type?: string
  url?: string
}

export interface ResolvedMcpClientTarget {
  client: SupportedMcpClient
  configPath: string
  displayName: string
  serverName: string
}

export interface McpClientConfigPlan {
  entry: McpClientConfigEntry
  preview: string
  target: ResolvedMcpClientTarget
  transport: McpClientTransport
}

export interface McpClientDoctorResult {
  configExists: boolean
  configPath: string
  displayName: string
  httpReachable?: boolean
  issues: string[]
  serverName: string
  transport?: McpClientTransport
}
