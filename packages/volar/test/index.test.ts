import plugin from '../src/index'

describe('@weapp-vite/volar plugin', () => {
  it('uses the latest Vue language plugin version', () => {
    const result = plugin({} as any)
    const items = Array.isArray(result) ? result : [result]
    for (const entry of items) {
      expect(entry.version).toBe(2.2)
    }
  })
})
