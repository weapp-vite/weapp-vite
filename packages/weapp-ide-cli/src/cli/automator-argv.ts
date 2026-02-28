import process from 'node:process'

export interface ParsedAutomatorArgs {
  projectPath: string
  timeout?: number
  json: boolean
  positionals: string[]
}

/**
 * @description 解析 automator 命令通用参数与位置参数。
 */
export function parseAutomatorArgs(argv: readonly string[]): ParsedAutomatorArgs {
  const positionals: string[] = []
  let projectPath = process.cwd()
  let timeout: number | undefined
  let json = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === '-p' || token === '--project') {
      const value = argv[index + 1]
      if (typeof value === 'string' && !value.startsWith('-')) {
        projectPath = value
        index += 1
      }
      else {
        projectPath = process.cwd()
      }
      continue
    }

    if (token.startsWith('--project=')) {
      projectPath = token.slice('--project='.length) || process.cwd()
      continue
    }

    if (token === '-t' || token === '--timeout') {
      const value = argv[index + 1]
      if (typeof value === 'string') {
        timeout = parsePositiveInt(value)
        index += 1
      }
      continue
    }

    if (token.startsWith('--timeout=')) {
      timeout = parsePositiveInt(token.slice('--timeout='.length))
      continue
    }

    if (token === '--json') {
      json = true
      continue
    }

    if (token.startsWith('-')) {
      const optionName = token.includes('=') ? token.slice(0, token.indexOf('=')) : token
      if (takesValue(optionName) && !token.includes('=')) {
        const value = argv[index + 1]
        if (typeof value === 'string' && !value.startsWith('-')) {
          index += 1
        }
      }
      continue
    }

    positionals.push(token)
  }

  return {
    projectPath,
    timeout,
    json,
    positionals,
  }
}

/**
 * @description 读取选项值，支持 --option value 与 --option=value。
 */
export function readOptionValue(argv: readonly string[], optionName: string): string | undefined {
  const optionWithEqual = `${optionName}=`

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === optionName) {
      const value = argv[index + 1]
      if (typeof value !== 'string') {
        return undefined
      }
      return value.trim()
    }

    if (token.startsWith(optionWithEqual)) {
      return token.slice(optionWithEqual.length).trim()
    }
  }

  return undefined
}

/**
 * @description 删除参数中的指定选项（同时支持 --opt value 与 --opt=value）。
 */
export function removeOption(argv: readonly string[], optionName: string): string[] {
  const optionWithEqual = `${optionName}=`
  const nextArgv: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === optionName) {
      const nextToken = argv[index + 1]
      if (takesValue(optionName) && typeof nextToken === 'string' && !nextToken.startsWith('-')) {
        index += 1
      }
      continue
    }

    if (token.startsWith(optionWithEqual)) {
      continue
    }

    nextArgv.push(token)
  }

  return nextArgv
}

function parsePositiveInt(raw: string): number | undefined {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

function takesValue(optionName: string) {
  return optionName === '-p'
    || optionName === '--project'
    || optionName === '-t'
    || optionName === '--timeout'
    || optionName === '-o'
    || optionName === '--output'
    || optionName === '--page'
    || optionName === '--login-retry'
    || optionName === '--login-retry-timeout'
    || optionName === '--lang'
    || optionName === '--platform'
    || optionName === '--qr-output'
    || optionName === '-r'
    || optionName === '--result-output'
    || optionName === '--info-output'
    || optionName === '-i'
}
