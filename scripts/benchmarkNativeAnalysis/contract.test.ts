import { describe, expect, it, vi } from 'vitest'
import { parseOptions, sideOrder, TARGET } from './contract'
import { hmrEnvironment } from './hmr'
import { collectorEnvironment } from './native'

describe('native benchmark sampling contract', () => {
  it('freezes full pairs and the target before collection', () => {
    const options = parseOptions(['--mode=full', '--output=result', '--native-path=binding.node'])
    expect(options).toMatchObject({ mode: 'full', buildPairs: 7, hmrPairs: 20, runtime: 'classic' })
    expect(TARGET).toBe('build:weapp-vite-tailwindcss-tdesign-template:repeat:wall')
    expect(sideOrder(0)).toEqual(['off', 'on'])
    expect(sideOrder(1)).toEqual(['on', 'off'])
    expect(() => parseOptions(['--mode=full', '--output=result', '--native-path=binding.node', '--smoke-pairs=2'])).toThrow()
    expect(() => parseOptions(['--output=result', '--native-path=binding.node', '--threshold=50'])).toThrow()
  })

  it('requires two smoke pairs and rejects malformed options', () => {
    expect(parseOptions(['--output', 'result', '--native-path', 'binding.node'])).toMatchObject({ mode: 'smoke', buildPairs: 2, hmrPairs: 2 })
    expect(() => parseOptions(['--output=result', '--native-path=binding.node', '--smoke-pairs=1'])).toThrow()
    expect(() => parseOptions(['--output=result', '--output=again', '--native-path=binding.node'])).toThrow()
    expect(() => parseOptions(['--output=result'])).toThrow()
  })

  it('preserves native feature controls in all child environments', async () => {
    const inherited = { WEAPP_VITE_NATIVE_EXTRA: 'retained', NODE_ENV: 'production', WEAPP_VITE_NATIVE_AST_PATH: 'old' }
    expect(collectorEnvironment('on', 'verified', inherited)).toEqual({ ...inherited, WEAPP_VITE_NATIVE: '1', WEAPP_VITE_NATIVE_AST_PATH: 'verified' })
    vi.stubEnv('WEAPP_VITE_NATIVE_EXTRA', 'retained')
    vi.stubEnv('TEMPLATES_HMR_PLAN_ONLY', '1')
    try {
      const { INPUTS } = await import('./contract')
      const options = parseOptions(['--output=result', '--native-path=binding.node'])
      const env = hmrEnvironment(options, INPUTS[0], { side: 'on', marker: 'native-primary-0' } as never, 'project', 'directory', 'workspace')
      expect(env.WEAPP_VITE_NATIVE_EXTRA).toBe('retained')
      expect(env.WEAPP_VITE_NATIVE).toBe('1')
      expect(env.WEAPP_VITE_NATIVE_AST_PATH).toBe(options.nativePath)
      expect(env.TEMPLATES_HMR_PLAN_ONLY).toBeUndefined()
      expect(env.TEMPLATES_HMR_ARTIFACT_EVIDENCE).toBe('1')
    }
    finally {
      vi.unstubAllEnvs()
    }
  })
})
