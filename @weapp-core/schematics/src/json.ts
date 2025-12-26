/**
 * JSON Schema 定义
 * 从 Zod schemas 生成，用于编辑器自动补全和验证
 *
 * 注意：修改 schema 定义应该在 scripts/json.ts 中的 Zod 定义进行
 */
import { JSON_SCHEMA_DEFINITIONS as _JSON_SCHEMA_DEFINITIONS } from '../scripts/json'

export const JSON_SCHEMA_DEFINITIONS = _JSON_SCHEMA_DEFINITIONS as readonly [
  { filename: 'app.json', typeName: 'App', schema: unknown },
  { filename: 'component.json', typeName: 'Component', schema: unknown },
  { filename: 'page.json', typeName: 'Page', schema: unknown },
  { filename: 'sitemap.json', typeName: 'Sitemap', schema: unknown },
  { filename: 'theme.json', typeName: 'Theme', schema: unknown },
  { filename: 'plugin.json', typeName: 'Plugin', schema: unknown },
]
