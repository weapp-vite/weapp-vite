import type { JsonMcpConfigFile, McpClientConfigPlan } from './types'
import { fs } from '@weapp-core/shared'
import path from 'pathe'
import { inspectMcpClientConfig } from './inspect'
import { buildMcpClientConfigPlan, formatMcpQuickStart, resolveSupportedMcpClient } from './plan'
import { parseJsonConfig, upsertCodexManagedBlock } from './shared'

export type {
  JsonMcpConfigFile,
  JsonMcpServerEntry,
  McpClientConfigEntry,
  McpClientConfigPlan,
  McpClientDoctorResult,
  McpClientTransport,
  ResolvedMcpClientTarget,
  SupportedMcpClient,
} from './types'

export { buildMcpClientConfigPlan, formatMcpQuickStart, inspectMcpClientConfig, resolveSupportedMcpClient }

export async function writeMcpClientConfig(plan: McpClientConfigPlan) {
  await fs.ensureDir(path.dirname(plan.target.configPath))
  const existing = await fs.readFile(plan.target.configPath, 'utf8').catch(() => '')

  if (plan.target.client === 'codex') {
    const nextContent = upsertCodexManagedBlock(existing, plan.target.serverName, plan.preview)
    await fs.writeFile(plan.target.configPath, nextContent, 'utf8')
    return
  }

  const parsed = parseJsonConfig(existing, plan.target.configPath)
  const nextConfig: JsonMcpConfigFile = {
    ...parsed,
    mcpServers: {
      ...(parsed.mcpServers ?? {}),
      [plan.target.serverName]: plan.entry,
    },
  }
  await fs.writeFile(plan.target.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
}
