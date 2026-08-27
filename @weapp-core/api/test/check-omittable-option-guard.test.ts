import { describe, expect, it } from 'vitest'
import {
  isWechatApiTypesSourceFile,
  toPosixPath,
} from '../scripts/check-omittable-option-guard.mjs'

describe('check-omittable-option guard path matching', () => {
  it('normalizes Windows and POSIX separators before matching TypeScript source files', () => {
    const windowsStorePath = 'D:\\a\\weapp-vite\\weapp-vite\\node_modules\\.pnpm\\miniprogram-api-typings@4.1.0\\node_modules\\miniprogram-api-typings\\types\\wx\\lib.wx.api.d.ts'
    const posixStorePath = 'D:/a/weapp-vite/weapp-vite/node_modules/.pnpm/miniprogram-api-typings@4.1.0/node_modules/miniprogram-api-typings/types/wx/lib.wx.api.d.ts'

    expect(toPosixPath(windowsStorePath)).toBe(posixStorePath)
    expect(isWechatApiTypesSourceFile(windowsStorePath)).toBe(true)
    expect(isWechatApiTypesSourceFile(posixStorePath)).toBe(true)
  })

  it('does not match unrelated declaration files', () => {
    expect(isWechatApiTypesSourceFile('/tmp/miniprogram-api-typings/types/wx/lib.wx.cloud.d.ts')).toBe(false)
  })
})
