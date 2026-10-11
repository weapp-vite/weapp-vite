import path from 'node:path'
import process from 'node:process'

const ENV_LIST_SPLIT_PATTERN = /[,;\n]/
const TRAILING_PATH_SEPARATOR_PATTERN = /[\\/]+$/

function normalizeProjectPath(value: string) {
  return path.normalize(path.resolve(value)).replace(TRAILING_PATH_SEPARATOR_PATTERN, '')
}

/** 只信任显式登记的项目目录及其子目录，保留环境变量的既有列表格式。 */
export function createAutomatorProjectTrust(env: NodeJS.ProcessEnv = process.env) {
  const trustAll = env.WEAPP_VITE_E2E_TRUST_PROJECT === '1'
  const prefixes = (env.WEAPP_VITE_E2E_TRUST_PROJECTS || '')
    .split(ENV_LIST_SPLIT_PATTERN)
    .map(item => item.trim())
    .filter(Boolean)
    .map(normalizeProjectPath)

  return (projectPath: string | undefined) => {
    if (trustAll) {
      return true
    }
    if (!projectPath) {
      return false
    }
    const normalized = normalizeProjectPath(projectPath)
    return prefixes.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}${path.sep}`))
  }
}
