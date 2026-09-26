import { describe, expect, it } from 'vitest'
import { transformNestedWxssVars } from './wxss'

describe('WXSS nested variable semantics', () => {
  it.each([
    'line-height: var(--tw-leading, var(--text-xl--line-height));',
    'border-radius: var(--wot-action-sheet-radius, var(--wot-radius-large, var(--wot-n-8, 8px)));',
    'background-image: linear-gradient(to right, var(--start, var(--first)), var(--end, var(--last)));',
  ])('retains the cascade dependencies in %s', (declaration) => {
    const source = `.probe { ${declaration} }`
    expect(transformNestedWxssVars(source)).toBe(source)
  })
})
