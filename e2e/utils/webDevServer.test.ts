import { describe, expect, it } from 'vitest'
import { createWebDevServerEnv, resolveWebDevServerUrl } from './webDevServer'

describe('web dev server URL', () => {
  it('keeps CLI startup logging enabled outside the Vitest child environment', () => {
    expect(createWebDevServerEnv({
      CUSTOM_VALUE: 'kept',
      NODE_ENV: 'test',
      TEST: 'true',
      VITEST: 'true',
      VITEST_MODE: 'RUN',
      VITEST_POOL_ID: '1',
      VITEST_WORKER_ID: '2',
    })).toEqual({
      BROWSER: 'none',
      CUSTOM_VALUE: 'kept',
      NODE_ENV: 'development',
    })
  })

  it('reads the resolved Web URL after Vite falls back from an occupied port', () => {
    const logs = [
      'Port 5173 is in use, trying another one...',
      'MCP: http://127.0.0.1:20040/mcp',
      '\u001B[32mWeb\u001B[39m\uFF1Ahttp://127.0.0.1:5174/',
    ].join('\n')

    expect(resolveWebDevServerUrl(logs)).toBe('http://127.0.0.1:5174/')
  })

  it('does not treat unrelated service URLs as the Web application URL', () => {
    expect(resolveWebDevServerUrl('MCP: http://127.0.0.1:20040/mcp')).toBeUndefined()
  })
})
