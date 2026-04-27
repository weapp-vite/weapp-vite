import {
  APP_PRELUDE_CHUNK_MARKER,
  REQUEST_GLOBAL_BUNDLE_MARKER,
  REQUEST_GLOBAL_SYNTHETIC_EXPORT_NAME,
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
  WEVU_INLINE_MAP_KEY,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROVIDES_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_SLOT_NAMES_ATTR,
  WEVU_SLOT_NAMES_PROP,
} from '../src'

describe('@weapp-core/constants', () => {
  it('exports stable runtime markers and keys', () => {
    expect(APP_PRELUDE_CHUNK_MARKER).toBe('__wvAPR__')
    expect(REQUEST_GLOBAL_BUNDLE_MARKER).toBe('__wvRGB__')
    expect(REQUEST_GLOBAL_SYNTHETIC_EXPORT_NAME).toBe('__wvRGI__')
    expect(WEVU_CLASS_STYLE_RUNTIME_MODULE).toBe('__weapp_vite')
    expect(WEVU_INLINE_MAP_KEY).toBe('__weapp_vite_inline_map')
    expect(WEVU_PUBLIC_RUNTIME_KEY).toBe('$wevu')
    expect(WEVU_PROVIDES_KEY).toBe('__wevuProvides')
    expect(WEVU_PARENT_INSTANCE_KEY).toBe('__wevuParentInstance')
    expect(WEVU_SLOT_NAMES_PROP).toBe('vueSlots')
    expect(WEVU_SLOT_NAMES_ATTR).toBe('vue-slots')
  })
})
