/* eslint-disable ts/no-unused-vars */
import type { UserConfig, UserConfigExport, UserConfigFnObject } from 'vite'
import { defineConfig } from '@/config'

// 模拟 WeappViteConfig 类型
interface WeappViteConfig {
  customField?: string
}

// 测试：定义普通的 UserConfig 对象
describe('defineConfig', () => {
  it('should return the same UserConfig object when passed', () => {
    const config: UserConfig = {
      weapp: {
        customField: 'test-value',
      },
    }

    const result = defineConfig(config)
    expect(result).toEqual(config)
  })

  // 测试：支持异步的 Promise<UserConfig>
  it('should return the same Promise<UserConfig> when passed', async () => {
    const config: Promise<UserConfig> = Promise.resolve({
      weapp: {
        customField: 'test-value',
      },
    })

    const result = defineConfig(config)
    expect(await result).toEqual(await config)
  })

  // 测试：支持 UserConfigFnObject 的定义
  it('should return the same UserConfigFnObject when passed', () => {
    const config: UserConfigFnObject = {
      build: () => ({
        weapp: {
          customField: 'test-value',
        },
      }),
    }

    const result = defineConfig(config)
    expect(result).toEqual(config)
    expect(result.build).toBeInstanceOf(Function)
  })

  // 测试：支持 UserConfigExport 的定义 (UserConfig | Promise<UserConfig> | UserConfigFnObject)
  it('should return the same UserConfigExport when passed (UserConfig)', () => {
    const config: UserConfigExport = {
      weapp: {
        customField: 'test-value',
      },
    }

    const result = defineConfig(config)
    expect(result).toEqual(config)
  })

  it('should return the same UserConfigExport when passed (Promise<UserConfig>)', async () => {
    const config: UserConfigExport = Promise.resolve({
      weapp: {
        customField: 'test-value',
      },
    })

    const result = defineConfig(config)
    expect(await result).toEqual(await config)
  })

  it('should return the same UserConfigExport when passed (UserConfigFnObject)', () => {
    const config: UserConfigExport = {
      build: () => ({
        weapp: {
          customField: 'test-value',
        },
      }),
    }

    const result = defineConfig(config)
    expect(result).toEqual(config)
    if ('build' in result) {
      expect(result.build).toBeInstanceOf(Function)
    }
  })

  // 测试：空配置
  it('should return an empty object when passed an empty object', () => {
    const config: UserConfig = {}
    const result = defineConfig(config)
    expect(result).toEqual(config)
  })
})
