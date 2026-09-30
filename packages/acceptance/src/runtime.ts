import type { McpConfig, ProjectConfig, Tool, ToolContext } from '@weapp-agent/core/project'

export interface RuntimeConnection {
  tools: Tool[]
  close: () => Promise<void>
}
export type RuntimeConnector = (server: McpConfig, context: ToolContext, options: { config: ProjectConfig, fingerprint: string, builtin: boolean }) => Promise<RuntimeConnection>
