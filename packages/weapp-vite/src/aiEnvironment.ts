import process from 'node:process'
import { determineAgent } from '@vercel/detect-agent'

export interface AiDevelopmentEnvironment {
  agentName?: string
  isAgent: boolean
}

const AI_ENV_KEYS = [
  'CODEX_HOME',
  'CODEX_SANDBOX',
  'CODEX_USER_AGENT',
  'CLAUDECODE',
  'CLAUDE_CODE',
  'CURSOR_AGENT',
  'GITHUB_COPILOT_AGENT',
  'OPENAI_AGENT',
]

function isTruthyEnvValue(value: string | undefined) {
  if (value === undefined) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no'
}

/**
 * @description 判断当前命令是否由 AI 开发代理触发。
 */
export function isAiDevelopmentEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (isTruthyEnvValue(env.WEAPP_VITE_AI)) {
    return true
  }
  return AI_ENV_KEYS.some(key => isTruthyEnvValue(env[key]))
}

export function resolveAiDevelopmentEnvironmentFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AiDevelopmentEnvironment {
  if (isTruthyEnvValue(env.WEAPP_VITE_AI)) {
    return {
      agentName: env.WEAPP_VITE_AI.trim(),
      isAgent: true,
    }
  }
  if (isAiDevelopmentEnvironment(env)) {
    return {
      isAgent: true,
    }
  }
  return {
    isAgent: false,
  }
}

/**
 * @description 使用标准 agent 检测库识别 AI 终端，并保留 weapp-vite 显式环境变量兜底。
 */
export async function detectAiDevelopmentEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AiDevelopmentEnvironment> {
  const envResult = resolveAiDevelopmentEnvironmentFromEnv(env)
  if (envResult.isAgent) {
    return envResult
  }

  try {
    const result = await determineAgent()
    return {
      agentName: result.isAgent ? result.agent.name : undefined,
      isAgent: result.isAgent,
    }
  }
  catch {
    return envResult
  }
}

export function resolveBooleanLikeEnv(value: string | undefined): boolean | 'ai' | undefined {
  if (value === undefined) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (normalized === 'ai') {
    return 'ai'
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
}
