import { describe, expect, it } from 'vitest'
import {
  extractExecutionErrorText,
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredError,
} from '../src/cli/retry'

describe('retry helpers', () => {
  it('recognises login-required errors from code and message', () => {
    const error = {
      message: 'Error: 需要重新登录 (code 10)',
      stderr: '[error] code: 10',
    }

    expect(isWechatIdeLoginRequiredError(error)).toBe(true)
  })

  it('returns false for unrelated execution errors', () => {
    const error = {
      message: 'spawn EACCES',
      stderr: 'permission denied',
    }

    expect(isWechatIdeLoginRequiredError(error)).toBe(false)
  })

  it('extracts and concatenates known error fields', () => {
    const text = extractExecutionErrorText({
      message: 'line-1',
      shortMessage: 'line-2',
      stderr: 'line-3',
      stdout: 'line-4',
    })

    expect(text).toBe('line-1\nline-2\nline-3\nline-4')
  })

  it('formats login-required errors into concise lines', () => {
    const formatted = formatWechatIdeLoginRequiredError({
      message: 'Error: 错误 Error: 需要重新登录 (code 10)Error: 需要重新登录\n at xxx',
      stderr: '[error] { code: 10 }',
    })

    expect(formatted).toContain('微信开发者工具返回登录错误：')
    expect(formatted).toContain('- code: 10')
    expect(formatted).toContain('- message: 需要重新登录')
  })

  it('builds retry hotkey prompt text', () => {
    const prompt = formatRetryHotkeyPrompt()

    expect(prompt).toContain('按')
    expect(prompt).toContain('r')
    expect(prompt).toContain('q')
    expect(prompt).toContain('Esc')
    expect(prompt).toContain('Ctrl+C')
  })

  it('returns empty text for invalid input', () => {
    expect(extractExecutionErrorText(undefined)).toBe('')
    expect(extractExecutionErrorText('oops')).toBe('')
  })
})
