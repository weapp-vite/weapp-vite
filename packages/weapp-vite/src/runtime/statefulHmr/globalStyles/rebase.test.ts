import { describe, expect, it } from 'vitest'
import { createStatefulHmrStyleRebaser } from './rebase'

describe('stateful global stylesheet rebasing', () => {
  it('rebases relative URL tokens without changing external references or ordinary strings', () => {
    const source = String.raw`.probe {
  background: url('./assets/bg.png?v=1#icon'), URL(icons/a.svg), image-set(url("../shared/a.png") 1x);
  mask: url(data:image/svg+xml;base64,AA), url(https://example.test/a), url(//example.test/a), url(/assets/a), url(#mask), url(?v=2), url(plugin://provider/a);
  content: "url(./not-an-asset.png)";
  cursor: url('./assets/a\#b.svg?size=1#cursor'), url(./assets/a\ b.png);
}`
    const rebase = createStatefulHmrStyleRebaser(new Map([['styles/global.wxss', source]]))
    const result = rebase('styles/global.wxss', 'feature/pages/detail/index.wxss')
    expect(result).toContain('url(\'../../../styles/assets/bg.png?v=1#icon\')')
    expect(result).toContain('URL(../../../styles/icons/a.svg)')
    expect(result).toContain('image-set(url("../../../shared/a.png") 1x)')
    expect(result).toContain('mask: url(data:image/svg+xml;base64,AA), url(https://example.test/a), url(//example.test/a), url(/assets/a), url(#mask), url(?v=2), url(plugin://provider/a)')
    expect(result).toContain('content: "url(./not-an-asset.png)"')
    expect(result).toContain(String.raw`url('../../../styles/assets/a\#b.svg?size=1#cursor')`)
    expect(result).toContain(String.raw`url(../../../styles/assets/a\ b.png)`)
    expect(rebase('styles/global.wxss', 'index.wxss')).toContain('url(\'./styles/assets/bg.png?v=1#icon\')')
  })

  it('recursively expands current output imports in cascade order and rebases each dependency once', () => {
    const rebase = createStatefulHmrStyleRebaser(new Map([
      ['global.wxss', '@import "./styles/theme.wxss"; .probe { color: red; }'],
      ['styles/theme.wxss', '@charset "UTF-8"; @import url("./tokens.wxss"); .probe { background: url("./images/a.png"); }'],
      ['styles/tokens.wxss', '.probe { color: blue; mask: url("../assets/mask.svg#shape"); }'],
    ]))
    const result = rebase('global.wxss', 'pages/index/index.wxss')
    expect(result).not.toMatch(/@(?:import|charset)/)
    expect(result).toContain('url("../../assets/mask.svg#shape")')
    expect(result).toContain('url("../../styles/images/a.png")')
    expect(result.indexOf('color: blue')).toBeLessThan(result.indexOf('background:'))
    expect(result.indexOf('background:')).toBeLessThan(result.indexOf('color: red'))
  })

  it('wraps media imports and retains unknown, qualified, native and external imports', () => {
    const rebase = createStatefulHmrStyleRebaser(new Map([
      ['styles/global.wxss', '@import "./known.wxss" screen and (min-width: 1px);\n@import "./known.wxss?v=2#theme";\n@import url("./missing.wxss");\n@import "./known.wxss" layer(theme) supports(display: grid);\n@import "/native.wxss";\n@import "https://example.test/global.wxss";'],
      ['styles/known.wxss', '.known { background: url(../assets/a.png); }'],
    ]))
    const result = rebase('styles/global.wxss', 'pages/index.wxss')
    expect(result).toContain('@media screen and (min-width: 1px)')
    expect(result).toContain('.known { background: url(../assets/a.png); }')
    expect(result).toContain('@import "../styles/known.wxss?v=2#theme"')
    expect(result).toContain('@import url("../styles/missing.wxss")')
    expect(result).toContain('@import "../styles/known.wxss" layer(theme) supports(display: grid)')
    expect(result).toContain('@import "/native.wxss"')
    expect(result).toContain('@import "https://example.test/global.wxss"')
  })

  it('fails explicitly for cyclic dependencies and missing roots without filesystem access', () => {
    const rebase = createStatefulHmrStyleRebaser(new Map([
      ['global.wxss', '@import "./styles/theme.wxss";'],
      ['styles/theme.wxss', '@import "../global.wxss";'],
    ]))
    expect(() => rebase('global.wxss', 'pages/index.wxss')).toThrow('global.wxss -> styles/theme.wxss -> global.wxss')
    expect(() => rebase('missing.wxss', 'pages/index.wxss')).toThrow('missing from current output: missing.wxss')
  })
})
