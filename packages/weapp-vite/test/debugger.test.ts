import { createDebugger } from '@/debugger'
import createDebug from 'debug'

vi.mock('debug', () => ({
  default: vi.fn().mockImplementation((namespace) => {
    const mockDebug = (...args: any[]) => {
      console.log(`[${namespace}]`, ...args)
    }
    mockDebug.enabled = false
    return mockDebug
  }),
}))

describe('createDebugger', () => {
  it('should create a debugger with the given namespace', () => {
    const mockNamespace = 'weapp-vite:test'
    const debugInstance = createDebugger(mockNamespace)

    expect(createDebug).toHaveBeenCalledWith(mockNamespace)
    expect(debugInstance).toBeUndefined() // 因为默认 debug.enabled = false
  })

  // it('should return the debugger instance if debug is enabled', () => {
  //   const mockNamespace = 'weapp-vite:test'
  //   const mockDebug = createDebug(mockNamespace)
  //   mockDebug.enabled = true // 模拟启用调试

  //   const debugInstance = createDebugger(mockNamespace)
  //   expect(debugInstance).toBe(mockDebug)
  // })

  it('should return undefined if debug is not enabled', () => {
    const mockNamespace = 'weapp-vite:test'
    const debugInstance = createDebugger(mockNamespace)

    expect(debugInstance).toBeUndefined() // debug.enabled 默认为 false
  })

  // it('should only accept namespaces prefixed with "weapp-vite:"', () => {
  //   const invalidNamespace = 'invalid-prefix:test'

  //   // 因为 `namespace` 的类型已限制为 `weapp-vite:${string}`，但我们仍可以通过强制类型转换来测试
  //   expect(() => createDebugger(invalidNamespace as any)).toThrowError()
  // })
})
