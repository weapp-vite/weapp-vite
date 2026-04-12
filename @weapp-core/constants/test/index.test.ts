import {
  APP_PRELUDE_CHUNK_MARKER,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
  WEVU_INLINE_MAP_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
} from '../src'

describe('@weapp-core/constants', () => {
  it('exports stable runtime markers and keys', () => {
    expect(APP_PRELUDE_CHUNK_MARKER).toBe('__wvAPR__')
    expect(REQUEST_GLOBAL_BUNDLE_MARKER).toBe('__wvRGB__')
    expect(WEVU_CLASS_STYLE_RUNTIME_MODULE).toBe('__weapp_vite')
    expect(WEVU_INLINE_MAP_KEY).toBe('__weapp_vite_inline_map')
    expect(WEVU_PUBLIC_RUNTIME_KEY).toBe('$wevu')
  })
})
