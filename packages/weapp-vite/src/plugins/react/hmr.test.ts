import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReactHmrTemplateSource, resolveReactTemplateHmrCapability } from './hmr'
import * as compiler from './staticTemplate'

const file = '/project/src/pages/index/view.tsx'
const staticSource = 'export function View() { return <view>hello</view> }'
const dynamicSource = 'export const View = ({ items }) => <view>{items.map(item => <text>{item}</text>)}</view>'

afterEach(() => vi.restoreAllMocks())

describe('React template HMR capability', () => {
  it.each(['auto', 'static', 'dynamic'] as const)('owns %s template modules without claiming state retention', (renderMode) => {
    expect(isReactHmrTemplateSource({ renderMode }, file)).toBe(true)
    expect(resolveReactTemplateHmrCapability({ renderMode }, file, staticSource)).toMatchObject({
      renderMode: renderMode === 'dynamic' ? 'dynamic' : 'static',
      fallback: { code: 'patch-shape', files: [file] },
    })
  })

  it('uses the real static compiler result to classify an auto dynamic island', () => {
    const capability = resolveReactTemplateHmrCapability(true, file, dynamicSource)
    expect(capability).toMatchObject({ renderMode: 'dynamic', fallback: { code: 'patch-shape' } })
    expect(capability?.fallback.message).toContain('dynamic 模板')
  })

  it('preserves syntax errors and strict static compilation failures', () => {
    expect(() => resolveReactTemplateHmrCapability(true, file, 'export const View = () => <view>')).toThrow(SyntaxError)
    expect(() => resolveReactTemplateHmrCapability({ renderMode: 'static' }, file, dynamicSource)).toThrow('未找到直接 return JSX')
  })

  it('does not turn an unexpected compiler error into a supported dynamic island', () => {
    const failure = new Error('compiler failure')
    vi.spyOn(compiler, 'compileStaticReactPage').mockImplementation(() => {
      throw failure
    })
    expect(() => resolveReactTemplateHmrCapability(true, file, staticSource)).toThrow(failure)
  })

  it.each(['auto', 'dynamic'] as const)('preserves invalid native bridge errors in %s mode', (renderMode) => {
    const source = `import { createNativeComponent } from '@weapp-vite/react'
const Native = createNativeComponent('native-card')
export const View = () => <Native />`
    expect(() => resolveReactTemplateHmrCapability({ renderMode }, file, source)).toThrow(/bridge/)
  })

  it('keeps native scripts, styles and dependencies outside the React template boundary', () => {
    for (const id of ['/project/src/page.ts', '/project/src/page.wxss', '/project/node_modules/pkg/view.tsx', 'C:\\project\\node_modules\\pkg\\view.tsx']) {
      expect(resolveReactTemplateHmrCapability(true, id, 'invalid source')).toBeUndefined()
    }
    expect(resolveReactTemplateHmrCapability(false, file, 'invalid source')).toBeUndefined()
  })
})
