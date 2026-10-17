import { stripVTControlCharacters } from 'node:util'

interface CliOutput {
  output: string
  outputTruncated: boolean
}

interface DiagnosticError extends Error {
  cliOutput?: string
}

/** 将本次 CLI 的有界输出附到原始错误，避免泄露登录票据及账号参数。 */
export function attachCliDiagnostics(error: unknown, state: CliOutput, secrets: string[] = []): Error {
  const original = error instanceof Error ? error : new Error('Failed to launch WeChat DevTools', { cause: error })
  if ((original as DiagnosticError).cliOutput !== undefined) {
    return original
  }
  let output = stripVTControlCharacters(state.output).trim()
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.split(secret).join('[redacted]')
  }
  output = output.replace(/(authorization["']?\s*[:=]\s*["']?)(?:Bearer|Basic)\s+[^\s"',;}]+/gi, '$1[redacted]')
  output = output.replace(/((?:--)?(?:auto-account|account|ticket|access[_-]?token|refresh[_-]?token|token|authorization)["']?\s*(?:[:=]\s*|\s))(["']?)([^\s"',;}]+)\2/gi, '$1[redacted]')
  if (!output) {
    return original
  }
  const truncated = state.outputTruncated || output.length > 32_768
  output = output.slice(-32_768)
  const target: DiagnosticError = Object.isExtensible(original) ? original : new Error(original.message, { cause: original })
  target.cliOutput = output
  target.message += `\ncli output${truncated ? ' (truncated; last 32768 characters)' : ''}:\n${output}`
  return target
}
