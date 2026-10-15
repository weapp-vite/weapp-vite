export interface McpCommandOptions {
  c?: string
  config?: string
  endpoint?: string
  host?: string
  port?: number | string
  rest?: boolean
  restEndpoint?: string
  transport?: 'command' | 'http' | 'stdio' | 'streamable-http'
  unref?: boolean
  url?: string
  workspaceRoot?: string
  yes?: boolean
}
