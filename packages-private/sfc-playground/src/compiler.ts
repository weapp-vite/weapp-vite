import type { SFCBlock } from 'vue/compiler-sfc'
import { parse as parseJson } from 'comment-json'
import { compileScript, parse } from 'vue/compiler-sfc'
import { compileVueStyleToWxss } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/style'
import { compileVueTemplateToWxml } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template'
import { generateScopedId } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/transform/scopedId'
import { transformScript } from '../../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript'

export type OutputPaneKey = 'script' | 'template' | 'style' | 'config' | 'meta' | 'warnings'

export interface CompileOutputState {
  success: boolean
  activeFilename: string
  durationMs: number
  outputs: Record<OutputPaneKey, string>
  error?: string
}

const EMPTY_OUTPUT_TEXT: Record<OutputPaneKey, string> = {
  script: '// 当前没有生成 script 产物。',
  template: '<!-- 当前没有生成 template 产物。 -->',
  style: '/* 当前没有生成 style 产物。 */',
  config: '{\n  "note": "当前没有生成 config 产物。"\n}',
  meta: '{\n  "note": "当前没有生成 meta 信息。"\n}',
  warnings: '// 当前没有编译警告。',
}

const SETUP_CALL_RE = /\bsetup\s*\(/
const JSON_MACRO_RE = /\bdefine(?:App|Page|Component|Sitemap|Theme)Json\s*\(/
const LEADING_RELATIVE_PATH_RE = /^\.?\//

function normalizeFilename(filename: string) {
  if (filename.startsWith('/')) {
    return filename
  }

  return `/playground/${filename.replace(LEADING_RELATIVE_PATH_RE, '')}`
}

function normalizeLineEndings(source: string) {
  return source.replace(/\r\n/g, '\n')
}

function formatJsonLike(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  }
  catch {
    return value
  }
}

function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  const next = { ...target }

  for (const [key, value] of Object.entries(source)) {
    const previous = next[key]
    if (
      previous
      && value
      && typeof previous === 'object'
      && typeof value === 'object'
      && !Array.isArray(previous)
      && !Array.isArray(value)
    ) {
      next[key] = deepMerge(previous, value)
      continue
    }
    next[key] = value
  }

  return next
}

function compileJsonBlocks(blocks: SFCBlock[], filename: string, warnings: string[]) {
  const jsonBlocks = blocks.filter(block => block.type === 'json')
  if (!jsonBlocks.length) {
    return undefined
  }

  let accumulator: Record<string, any> = {}
  for (const block of jsonBlocks) {
    const lang = (block.lang ?? 'json').toLowerCase()
    if (lang !== 'json' && lang !== 'jsonc' && lang !== 'json5' && lang !== 'txt') {
      warnings.push(`[browser compiler] 暂不支持执行 <json lang="${lang}">。请改用 json/jsonc/json5。`)
      continue
    }

    try {
      const parsed = parseJson(block.content, undefined, true) as Record<string, any>
      accumulator = deepMerge(accumulator, parsed)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`解析 <json> 块失败：${filename}: ${message}`)
    }
  }

  return Object.keys(accumulator).length > 0
    ? JSON.stringify(accumulator, null, 2)
    : undefined
}

export async function compileWevuSfc(source: string, filename: string): Promise<CompileOutputState> {
  const start = performance.now()
  const warnings: string[] = []

  if (!filename.endsWith('.vue')) {
    return {
      success: false,
      activeFilename: filename,
      durationMs: Math.round(performance.now() - start),
      error: `当前文件 ${filename} 不是 .vue，无法走 wevu SFC 编译链。`,
      outputs: {
        ...EMPTY_OUTPUT_TEXT,
        warnings: '// 请选择 .vue 文件查看编译结果。',
      },
    }
  }

  try {
    const normalizedFilename = normalizeFilename(filename)
    const normalizedSource = normalizeLineEndings(source)
    const parsed = parse(normalizedSource, {
      filename: normalizedFilename,
      ignoreEmpty: true,
    })

    if (parsed.errors.length > 0) {
      const firstError = parsed.errors[0]
      throw new Error(firstError instanceof Error ? firstError.message : String(firstError))
    }

    const { descriptor } = parsed
    const templateResult = descriptor.template
      ? compileVueTemplateToWxml(descriptor.template.content, normalizedFilename)
      : undefined

    warnings.push(...(templateResult?.warnings ?? []))

    let scriptOutput = EMPTY_OUTPUT_TEXT.script
    if (descriptor.script || descriptor.scriptSetup) {
      const compiledScript = compileScript(descriptor, {
        id: normalizedFilename,
        isProd: false,
      })

      let scriptCode = compiledScript.content
      if (JSON_MACRO_RE.test(scriptCode)) {
        warnings.push('[browser compiler] 暂不执行 definePageJson/defineComponentJson 等 JSON 宏，请改用 <json lang="json"> 观察 config 产物。')
      }
      if (!scriptCode.includes('export default')) {
        scriptCode += '\nexport default {}'
      }

      const transformed = transformScript(scriptCode, {
        isPage: true,
        templateRefs: templateResult?.templateRefs,
        layoutHosts: templateResult?.layoutHosts,
        inlineExpressions: templateResult?.inlineExpressions,
        classStyleRuntime: templateResult?.classStyleRuntime,
        classStyleBindings: templateResult?.classStyleBindings,
      })
      scriptOutput = transformed.code
    }

    const styleOutput = descriptor.styles.length > 0
      ? descriptor.styles.map((block) => {
          return compileVueStyleToWxss(block, {
            id: generateScopedId(normalizedFilename),
            scoped: block.scoped,
            modules: block.module,
          }).code
        }).join('\n\n')
      : EMPTY_OUTPUT_TEXT.style

    const configOutput = compileJsonBlocks(descriptor.customBlocks, normalizedFilename, warnings)

    return {
      success: true,
      activeFilename: filename,
      durationMs: Math.round(performance.now() - start),
      outputs: {
        script: scriptOutput,
        template: templateResult?.code ?? EMPTY_OUTPUT_TEXT.template,
        style: styleOutput,
        config: formatJsonLike(configOutput, EMPTY_OUTPUT_TEXT.config),
        meta: JSON.stringify({
          hasScriptSetup: Boolean(descriptor.scriptSetup),
          hasSetupOption: Boolean(descriptor.script?.content && SETUP_CALL_RE.test(descriptor.script.content)),
          customBlockTypes: descriptor.customBlocks.map(block => ({
            type: block.type,
            lang: block.lang ?? 'plain',
          })),
        }, null, 2),
        warnings: warnings.length > 0 ? warnings.join('\n') : EMPTY_OUTPUT_TEXT.warnings,
      },
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)

    return {
      success: false,
      activeFilename: filename,
      durationMs: Math.round(performance.now() - start),
      error: message,
      outputs: {
        ...EMPTY_OUTPUT_TEXT,
        warnings: warnings.length > 0 ? warnings.join('\n') : EMPTY_OUTPUT_TEXT.warnings,
      },
    }
  }
}
