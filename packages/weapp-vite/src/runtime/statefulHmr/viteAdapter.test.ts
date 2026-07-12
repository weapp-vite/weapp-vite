import { describe, expect, it } from 'vitest'
import { createStatefulHmrBanner, createStatefulHmrFooter, toStableModuleId } from './viteAdapter'

describe('stateful HMR Vite adapter', () => {
  it('installs native page registration and flushes component definitions for entry chunks', () => {
    const banner = createStatefulHmrBanner({ fileName: 'pages/index/index.js', isEntry: true })

    expect(banner).toContain('installNative(\'Page\', definition => Page(definition))')
    expect(banner).not.toContain('installNative(\'Component\'')
    expect(createStatefulHmrFooter({ fileName: 'pages/index/index.js', isEntry: true }))
      .toContain('takeNativeDefinitions(\'Component\')')
  })

  it('keeps virtual ids stable and normalizes source ids relative to root', () => {
    expect(toStableModuleId('\0virtual:entry', '/project')).toBe('\0virtual:entry')
    expect(toStableModuleId('/project/src/pages/index.ts', '/project')).toBe('src/pages/index.ts')
    expect(toStableModuleId('C:\\project\\src\\pages\\index.ts', 'C:\\project')).toBe('src/pages/index.ts')
  })
})
