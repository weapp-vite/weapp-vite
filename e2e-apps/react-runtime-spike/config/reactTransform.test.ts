import { describe, expect, it } from 'vitest'
import { transformReactTsx } from './reactTransform'

const source = `
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
`

describe('React TSX transform', () => {
  it('keeps Oxc as a JSX-only baseline', async () => {
    const result = await transformReactTsx(source, 'counter.tsx', 'oxc')

    expect(result.code).toContain('react/jsx-runtime')
    expect(result.code).not.toContain('react/compiler-runtime')
  })

  it('uses the SWC Rust React Compiler transform', async () => {
    const result = await transformReactTsx(source, 'counter.tsx', 'swc-react-compiler')

    expect(result.code).toContain('react/jsx-runtime')
    expect(result.code).toContain('react/compiler-runtime')
  })
})
