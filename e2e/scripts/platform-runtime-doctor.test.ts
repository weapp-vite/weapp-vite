/* eslint-disable e18e/ban-dependencies -- doctor CLI 测试需要隔离 PATH 并断言进程退出码。 */
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

const SCRIPT_PATH = path.resolve(import.meta.dirname, 'platform-runtime-doctor.ts')

describe('platform runtime doctor', () => {
  it('reports planned platforms without presenting them as ready', async () => {
    const result = await execa(process.execPath, ['--import', 'tsx', SCRIPT_PATH], {
      env: {
        WEAPP_VITE_PLATFORM_DOCTOR_PATH: '',
        WEAPP_VITE_PLATFORM_DOCTOR_SKIP_DEFAULT_PATHS: '1',
        WEAPP_VITE_SWAN_WS_ENDPOINT: '',
      },
    })
    const report = JSON.parse(result.stdout) as {
      diagnostics: Array<{ id: string, build: string, ready: boolean }>
    }
    expect(report.diagnostics.find(item => item.id === 'ks')).toMatchObject({
      build: 'planned',
      ready: false,
    })
    expect(report.diagnostics.find(item => item.id === 'dingtalk')).toMatchObject({
      build: 'planned',
      ready: false,
    })
  })

  it('uses a stable non-zero exit code when a required CLI is missing', async () => {
    const result = await execa(process.execPath, ['--import', 'tsx', SCRIPT_PATH, '--require', 'alipay'], {
      env: {
        WEAPP_VITE_PLATFORM_DOCTOR_PATH: '',
        WEAPP_VITE_PLATFORM_DOCTOR_SKIP_DEFAULT_PATHS: '1',
      },
      reject: false,
    })
    expect(result.exitCode).toBe(1)
    const report = JSON.parse(result.stdout) as {
      diagnostics: Array<{ id: string, ready: boolean, reason: string }>
    }
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        id: 'alipay',
        ready: false,
        reason: expect.stringContaining('minidev'),
      }),
    ])
  })
})
