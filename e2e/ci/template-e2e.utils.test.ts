import { describe, expect, it } from 'vitest'
import { formatWxss } from '../template-e2e.utils'

describe('formatWxss', () => {
  it('normalizes semantically equivalent css printer output', async () => {
    const legacyOutput = `
view,
text,
:before,
:after {
  --tw-ring-color: rgba(59, 130, 246, 0.50196);
  color: rgba(0, 0, 0, 0);
  transition-duration: 0.15s;
  margin-top: 0px !important;
}
.icon {
  width: 1em;
  height: 1em;
  -webkit-mask-image: var(--svg);
  mask-image: var(--svg);
  --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E");
  background-color: currentColor;
  display: inline-block;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}
/*$vite$:1*/
`

    const canonicalOutput = `
view,
text,
::before,
::after {
  color: transparent;
  margin-top: 0 !important;
  transition-duration: 150ms;
  --tw-ring-color: #3b82f680;
}
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask-image: var(--svg);
  mask-image: var(--svg);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  --svg: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E");
}
`

    expect(await formatWxss(legacyOutput)).toBe(await formatWxss(canonicalOutput))
  })

  it('keeps duplicate declarations in source order to preserve fallback semantics', async () => {
    const formatted = await formatWxss(`
.demo {
  display: -webkit-box;
  display: flex;
  color: red;
}
`)

    expect(formatted.indexOf('display: -webkit-box')).toBeLessThan(formatted.indexOf('display: flex'))
  })
})
