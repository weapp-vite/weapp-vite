import type { TransformResult, TransformScriptOptions } from './utils'
import { WE_VU_RUNTIME_APIS } from '../../../../constants'
import { RUNTIME_IMPORT_PATH } from '../constants'

const COMPILED_DEFINE_COMPONENT_IMPORT_RE = /^import\s+\{\s*defineComponent\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s+from\s+['"]vue['"];?\n/
const EXPORT_DEFAULT_PURE_RE = /export\s+default\s+\/\*@__PURE__\*\/\s*/
const JSON_MACRO_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/
const PAGE_META_RE = /\bdefinePageMeta\s*\(/

function hasMetadataInjectionOptions(options: TransformScriptOptions | undefined) {
  const hasWevuDefaults = options?.wevuDefaults && Object.keys(options.wevuDefaults).length > 0
  return Boolean(
    options?.isApp
    || options?.skipComponentTransform
    || options?.minify
    || options?.sourceMap !== false
    || options?.templateComponentMeta
    || hasWevuDefaults
    || options?.classStyleBindings?.length
    || options?.templateRefs?.length
    || options?.layoutHosts?.length
    || options?.inlineExpressions?.length
    || options?.functionPropPaths?.length
    || options?.propsAliases
    || options?.propsDerivedKeys?.length
    || options?.relaxStructuredTypeOnlyProps
    || options?.scopedSlotHostProperties,
  )
}

function findMatchingCallEnd(source: string, openParenIndex: number) {
  let depth = 0
  let quote: string | undefined
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let index = openParenIndex; index < source.length; index += 1) {
    const current = source[index]!
    const next = source[index + 1]
    if (lineComment) {
      if (current === '\n' || current === '\r') {
        lineComment = false
      }
      continue
    }
    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
      }
      else if (current === '\\') {
        escaped = true
      }
      else if (current === quote) {
        quote = undefined
      }
      continue
    }
    if (current === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (current === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (current === '"' || current === '\'' || current === '`') {
      quote = current
      continue
    }
    if (current === '(') {
      depth += 1
      continue
    }
    if (current === ')') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

function stripCompiledScriptSetupMarkers(optionsSource: string) {
  return optionsSource
    .replace(/^\s*__name:\s*['"][^'"]+['"],?\n?/m, '')
    .replace(/\{\s*expose:\s*__expose\s*\}/g, '{ expose }')
    .replace(/\b__expose\s*\(\s*\);?/g, 'expose();')
    .replace(/^\s*Object\.defineProperty\(\s*__returned__\s*,\s*['"]__isScriptSetup['"]\s*,\s*\{\s*enumerable:\s*false\s*,\s*value:\s*true\s*\}\s*\);?\n?/m, '')
}

/**
 * 转换 Vue compileScript 产出的标准 `<script setup>` 脚本。
 */
export function tryFastTransformCompiledScriptSetup(
  source: string,
  options: TransformScriptOptions | undefined,
): TransformResult | undefined {
  if (hasMetadataInjectionOptions(options)) {
    return undefined
  }
  if (JSON_MACRO_RE.test(source) || PAGE_META_RE.test(source)) {
    return undefined
  }

  const importMatch = source.match(COMPILED_DEFINE_COMPONENT_IMPORT_RE)
  if (!importMatch) {
    return undefined
  }
  const defineComponentLocal = importMatch[1]
  const afterImport = source.slice(importMatch[0].length)
  if (/from\s+['"]vue['"]/.test(afterImport)) {
    return undefined
  }

  const exportMatch = EXPORT_DEFAULT_PURE_RE.exec(afterImport)
  if (!exportMatch || exportMatch.index < 0) {
    return undefined
  }
  const beforeExport = afterImport.slice(0, exportMatch.index)
  const callStart = exportMatch.index + exportMatch[0].length
  const expectedCall = `${defineComponentLocal}(`
  if (!afterImport.startsWith(expectedCall, callStart)) {
    return undefined
  }
  const openParenIndex = callStart + defineComponentLocal.length
  const callEnd = findMatchingCallEnd(afterImport, openParenIndex)
  if (callEnd < 0) {
    return undefined
  }
  const trailing = afterImport.slice(callEnd + 1).trim()
  if (trailing && trailing !== ';') {
    return undefined
  }

  const componentOptions = stripCompiledScriptSetupMarkers(afterImport.slice(openParenIndex + 1, callEnd).trim())
  const pageMarker = options?.isPage ? ' __wevu_isPage: true,\n' : ''
  const code = [
    `import { ${WE_VU_RUNTIME_APIS.createWevuComponent} } from "${RUNTIME_IMPORT_PATH}";`,
    beforeExport.trim(),
    `const __wevuOptions = {\n${pageMarker}${componentOptions.replace(/^\{\s*/, '').replace(/\s*\}$/, '')}\n};`,
    'export default __wevuOptions;',
    `${WE_VU_RUNTIME_APIS.createWevuComponent}(__wevuOptions);`,
  ].filter(Boolean).join('\n')

  return {
    code,
    map: null,
    transformed: true,
  }
}
