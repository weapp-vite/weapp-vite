import { describe, expect, it } from 'vitest'
import {
  extractExecutionErrorText,
  isWechatIdeLoginRequiredError,
} from './retry'

describe('cli retry helpers', () => {
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

  it('returns empty text for invalid input', () => {
    expect(extractExecutionErrorText(undefined)).toBe('')
    expect(extractExecutionErrorText('oops')).toBe('')
  })
})
