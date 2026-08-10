import { describe, expect, it } from 'vitest'
import { UPSTREAM_COMPATIBILITY_CASES } from './upstreamCompatibility'
import { transformVueJsxScript } from './vueJsxTransform'

describe('transformVueJsxScript', () => {
  it('transforms JSX through @vue/babel-plugin-jsx', () => {
    const result = transformVueJsxScript(
      'export const fragment = <view class="card">hello</view>',
      '/project/src/shared.tsx',
      false,
    )

    expect(result.code).not.toContain('<view')
    expect(result.code).toContain('createVNode')
    expect(result.code).toContain('createTextVNode')
  })

  it.each(UPSTREAM_COMPATIBILITY_CASES)(
    'transforms adapted upstream $category syntax before script compilation',
    ({ source }) => {
      const result = transformVueJsxScript(
        `export const render = () => (${source})`,
        '/project/src/upstream.tsx',
        false,
      )
      expect(result.code).not.toMatch(/<[A-Z>]/i)
      expect(result.code).toContain('export const render')
    },
  )

  it('enables transformOn and object slots in the shared default options', () => {
    const result = transformVueJsxScript(
      `export const render = () => <Panel on={{ tap }}>{{ default: () => <text>slot</text> }}</Panel>`,
      '/project/src/options.tsx',
      false,
    )
    expect(result.code).toContain('transformOn')
    expect(result.code).toContain('default:')
  })

  it('supports the upstream optimize and mergeProps options', () => {
    const optimized = transformVueJsxScript(
      'export const render = props => <Panel class="base" {...props} />',
      '/project/src/optimized.tsx',
      false,
    )
    expect(optimized.code).toContain('mergeProps')
    expect(optimized.code).toMatch(/createVNode\([\s\S]*,\s*16\)/)

    const unmerged = transformVueJsxScript(
      'export const render = props => <Panel class="base" {...props} />',
      '/project/src/unmerged.tsx',
      false,
      { mergeProps: false, optimize: false },
    )
    expect(unmerged.code).not.toContain('mergeProps')
    expect(unmerged.code).toContain('...props')
  })

  it('supports disabling object slot inference while retaining v-slots', () => {
    const inferred = transformVueJsxScript(
      'export const render = slots => <Panel>{slots}</Panel>',
      '/project/src/object-slots.tsx',
      false,
    )
    expect(inferred.code).toContain('isSlot')

    const disabled = transformVueJsxScript(
      'export const render = slots => <Panel>{slots}</Panel>',
      '/project/src/object-slots-disabled.tsx',
      false,
      { enableObjectSlots: false },
    )
    expect(disabled.code).not.toContain('isSlot')

    const explicit = transformVueJsxScript(
      'export const render = slots => <Panel v-slots={slots} />',
      '/project/src/v-slots.tsx',
      false,
      { enableObjectSlots: false },
    )
    expect(explicit.code).toContain('createVNode')
    expect(explicit.code).toContain('slots')
  })

  it('resolves functional component prop types when resolveType is enabled', () => {
    const result = transformVueJsxScript(
      `
import { defineComponent } from 'vue'
interface Props { title: string; count?: number }
export default defineComponent((props: Props) => <view>{props.title}</view>)
      `,
      '/project/src/typed.tsx',
      false,
      { resolveType: true },
    )
    expect(result.code).toContain('props: {')
    expect(result.code).toMatch(/title:\s*\{\s*type:\s*String,\s*required:\s*true/)
    expect(result.code).toMatch(/count:\s*\{\s*type:\s*Number,\s*required:\s*false/)
  })
})
