export const BLOCK_TYPE = 'json'
export const JS_LANG = 'js'
export const JSONC_LANG = 'jsonc'
export const JSON_LANG = 'json'
export const JSON5_LANG = 'json5'
export const PLUGIN_VERSION = 2.2 as const
export const TS_LANG = 'ts'
export const TS_SCRIPT_KIND_JS = 1
export const TS_SCRIPT_KIND_TS = 3
export const TS_SCRIPT_TARGET_LATEST = 99

export const BACKSLASH_RE = /\\/g
export const DEFINE_OPTIONS_NAME = 'defineOptions'
export const IDENTIFIER_NAME_RE = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u
export const NON_SPACE_RE = /\S/
export const WXS_MODULE_RE = /<wxs[\s\S]*?module\s*=\s*(?:"([^"]+)"|'([^']+)')[\s\S]*?\/?>/gi

export const FULL_CAPABILITIES = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: true,
  format: true,
} as const

export const VOID_CAPABILITIES = {
  verification: false,
  completion: false,
  semantic: false,
  navigation: false,
  structure: false,
  format: false,
} as const
