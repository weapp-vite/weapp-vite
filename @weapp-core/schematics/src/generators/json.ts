import type { GenerateJsonOptions, GenerateType } from '../generator'
import { DEFAULT_APP_JSON, DEFAULT_COMPONENT_JSON, DEFAULT_PAGE_JSON } from '../constants'
import { toJsonString } from '../utils/stringify'

const JSON_DEFAULTS = {
  app: toJsonString(DEFAULT_APP_JSON),
  page: toJsonString(DEFAULT_PAGE_JSON),
  component: toJsonString(DEFAULT_COMPONENT_JSON),
} as const satisfies Record<GenerateType, string>

const MODULE_DEFAULTS = {
  app: `import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages: [
    'pages/index/index',
  ],
  usingComponents: {},
})
`,
  page: `import { definePageJson } from 'weapp-vite/json'

export default definePageJson({
  usingComponents: {},
})
`,
  component: `import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
`,
} as const satisfies Record<GenerateType, string>

function normalizeType(type?: GenerateType): GenerateType {
  return (type ?? 'component')
}

/**
 * @description 生成 JSON / JS / TS 模板
 */
export function generateJson(options: GenerateJsonOptions = {}) {
  const { type, ext = 'json' } = options
  const normalizedType = normalizeType(type)

  if (ext === 'js' || ext === 'ts') {
    return MODULE_DEFAULTS[normalizedType]
  }

  return JSON_DEFAULTS[normalizedType]
}
