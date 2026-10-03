import { describe, expect, it } from 'vitest'
import { resolveConsumerToolchain } from '../scripts/consumerToolchains.mjs'

describe('published consumer toolchain selection', () => {
  const versions = {
    'vite': { vitest: '5.1.0' },
    'vite-plus': { version: '1.2.3', vitest: '5.0.1' },
  }

  it.each(['8.3.2', '8.4.0', '^8.4.0'])('uses the candidate Vite declaration %s without a second pinned engine', (vite) => {
    expect(resolveConsumerToolchain('vite', { name: 'weapp-vite', dependencies: { vite } }, versions)).toEqual({
      dependencies: { vite, vitest: '5.1.0' },
      overrides: {},
    })
  })

  it('keeps the Vite+ launcher, core alias and override on the same paired version', () => {
    expect(resolveConsumerToolchain('vite-plus', { name: 'weapp-vite', dependencies: { vite: '8.4.0' } }, versions)).toEqual({
      dependencies: { 'vite': 'npm:@voidzero-dev/vite-plus-core@1.2.3', 'vite-plus': '1.2.3', 'vitest': '5.0.1' },
      overrides: { vite: 'npm:@voidzero-dev/vite-plus-core@1.2.3' },
    })
  })

  it('does not install a separate host for the standalone CLI', () => {
    expect(resolveConsumerToolchain('wv', { name: 'weapp-vite', dependencies: { vite: '8.4.0' } }, versions))
      .toEqual({ dependencies: {}, overrides: {} })
  })

  it.each([undefined, '', ' ', 'catalog:', 'workspace:*', 'file:../vite', 'npm:other-vite@8.4.0', 'latest'])('rejects unpublished or unresolved Vite declarations: %s', (vite) => {
    expect(() => resolveConsumerToolchain('vite', { name: 'weapp-vite', dependencies: { vite } }, versions))
      .toThrow('published Vite version range')
  })

  it('rejects a different candidate manifest instead of falling back to a local engine', () => {
    expect(() => resolveConsumerToolchain('vite', { name: 'another-package', dependencies: { vite: '8.4.0' } }, versions))
      .toThrow('packed weapp-vite manifest')
  })

  it('rejects unpaired Vitest and Vite+ version ranges', () => {
    const manifest = { name: 'weapp-vite', dependencies: { vite: '8.4.0' } }
    expect(() => resolveConsumerToolchain('vite', manifest, { ...versions, vite: { vitest: '^5.1.0' } }))
      .toThrow('exact paired version')
    expect(() => resolveConsumerToolchain('vite-plus', manifest, { ...versions, 'vite-plus': { version: '^1.2.3', vitest: '5.0.1' } }))
      .toThrow('one exact paired version')
  })
})
