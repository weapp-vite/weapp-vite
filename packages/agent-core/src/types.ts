import type { z } from 'zod'

export interface ImageInput {
  type: 'image'
  data: string
  mediaType: string
}
export interface ToolCall {
  id: string
  name: string
  input: unknown
}
export type Message
  = | { role: 'user', text: string, images?: ImageInput[], origin?: 'user' | 'engine' }
    | { role: 'assistant', text: string, calls?: ToolCall[] }
    | {
      role: 'tool'
      callId: string
      name: string
      result: ToolResult
      error?: boolean
    }
export interface ToolResult {
  text: string
  images?: ImageInput[]
  data?: unknown
}
export type ModelChunk
  = | { type: 'text', text: string }
    | { type: 'call', call: ToolCall }
    | { type: 'usage', inputTokens: number, outputTokens: number }
export interface ModelRequest {
  system: string
  messages: Message[]
  tools: Array<{
    name: string
    description: string
    schema: Record<string, unknown>
  }>
  signal: AbortSignal
}
export interface ModelAdapter {
  readonly id: string
  stream: (request: ModelRequest) => AsyncIterable<ModelChunk>
}
export interface Approval {
  kind: 'trust' | 'command' | 'external' | 'mcp' | 'publish'
  summary: string
  fingerprint: string
}
export type Approver = (request: Approval) => Promise<boolean>
export interface ToolContext {
  root: string
  signal: AbortSignal
  trusted: boolean
  approve: Approver
}
export interface Tool {
  name: string
  description: string
  schema: z.ZodType
  /** Pure metadata. Every side effect still passes through execute's permission checks. */
  mutates: boolean
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>
}
export interface SessionEvent {
  version: 1
  sessionId: string
  sequence: number
  timestamp: string
  type: string
  data: Record<string, unknown>
}
export type RunStatus
  = 'completed' | 'failed' | 'cancelled' | 'action_required' | 'limit_reached'
export type RunLimitReason = 'max_steps' | 'context_budget'
export interface RunResult {
  sessionId: string
  status: RunStatus
  text: string
  reason?: RunLimitReason
}
export interface ProjectInfo {
  root: string
  kind: 'wevu' | 'native' | 'unknown'
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun'
  sourceRoot: string
  outputRoot: string
  pages: string[]
  subPackages: string[]
  scripts: Record<string, string>
  weappViteVersion?: string
  warnings: string[]
}
export interface ProjectAdapter {
  detect: (root: string) => Promise<ProjectInfo>
  instructions: (project: ProjectInfo) => Promise<string>
  tools: (project: ProjectInfo) => Promise<Tool[]>
}
