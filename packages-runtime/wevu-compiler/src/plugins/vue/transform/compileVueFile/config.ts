import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { JsonMergeContext } from '../../../../types/json'
import type { AutoImportTagsOptions, AutoUsingComponentsOptions, VueTransformResult } from './types'
import { collectVueTemplateTags, isAutoImportCandidateTag } from '../../../../utils/vueTemplateTags'
import { resolveWarnHandler } from '../../../../utils/warn'
import { compileConfigBlocks } from '../config'

type JsonMerger = (
  target: Record<string, any>,
  source: Record<string, any>,
  stage: JsonMergeContext['stage'],
) => Record<string, any>

function collectTemplateAutoImportTags(template: string, filename: string, warn?: (message: string) => void) {
  const warnHandler = resolveWarnHandler(warn)
  return collectVueTemplateTags(template, {
    filename,
    warnLabel: '自动导入标签',
    warn: (message: string) => warnHandler(message),
    shouldCollect: isAutoImportCandidateTag,
  })
}

export async function compileConfigPhase(params: {
  descriptor: Pick<SFCDescriptor, 'template' | 'customBlocks'>
  filename: string
  autoUsingComponentsMap: Record<string, string>
  autoUsingComponents: AutoUsingComponentsOptions | undefined
  autoImportTags: AutoImportTagsOptions | undefined
  jsonDefaults: Record<string, any> | undefined
  mergeJson: JsonMerger
  scriptSetupMacroConfig: Record<string, any> | undefined
  result: VueTransformResult
  warn?: (message: string) => void
}) {
  const {
    descriptor,
    filename,
    autoUsingComponentsMap,
    autoUsingComponents,
    autoImportTags,
    jsonDefaults,
    mergeJson,
    scriptSetupMacroConfig,
    result,
    warn,
  } = params

  let configObj: Record<string, any> | undefined
  if (descriptor.customBlocks.some(b => b.type === 'json')) {
    const configResult = await compileConfigBlocks(descriptor.customBlocks, filename, {
      merge: (target, source) => mergeJson(target, source, 'json-block'),
    })
    if (configResult) {
      try {
        configObj = JSON.parse(configResult)
      }
      catch {
        configObj = {}
      }
    }
  }

  const autoImportTagsMap: Record<string, string> = {}
  if (autoImportTags && descriptor.template) {
    const tags = collectTemplateAutoImportTags(descriptor.template.content, filename, autoImportTags.warn ?? warn)
    for (const tag of tags) {
      let resolved: { name: string, from: string } | undefined
      try {
        resolved = await autoImportTags.resolveUsingComponent!(tag, filename)
      }
      catch {
        resolved = undefined
      }

      if (!resolved?.from) {
        continue
      }

      autoImportTagsMap[resolved.name || tag] = resolved.from
    }
  }

  const shouldMergeUsingComponents = Object.keys(autoUsingComponentsMap).length > 0 || Object.keys(autoImportTagsMap).length > 0

  if (shouldMergeUsingComponents) {
    const existingRaw = configObj?.usingComponents
    const usingComponents: Record<string, string> = (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw))
      ? existingRaw
      : {}

    for (const [name, from] of Object.entries(autoImportTagsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        autoImportTags?.warn?.(
          `[Vue 编译] usingComponents 冲突：${filename} 中 <json>.usingComponents['${name}']='${usingComponents[name]}' 将被模板标签自动引入覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    for (const [name, from] of Object.entries(autoUsingComponentsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        autoUsingComponents?.warn?.(
          `[Vue 编译] usingComponents 冲突：${filename} 中 <json>.usingComponents['${name}']='${usingComponents[name]}' 将被 <script setup> 导入覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    configObj = mergeJson(configObj ?? {}, { usingComponents }, 'auto-using-components')
  }

  if (result.componentGenerics && Object.keys(result.componentGenerics).length > 0) {
    const existing = configObj?.componentGenerics
    const componentGenerics: Record<string, any> = (existing && typeof existing === 'object' && !Array.isArray(existing))
      ? existing
      : {}
    for (const [key, value] of Object.entries(result.componentGenerics)) {
      componentGenerics[key] = value
    }
    configObj = mergeJson(configObj ?? {}, { componentGenerics }, 'component-generics')
  }

  if (jsonDefaults && Object.keys(jsonDefaults).length > 0) {
    configObj = mergeJson(configObj ?? {}, jsonDefaults, 'defaults')
  }

  if (scriptSetupMacroConfig && Object.keys(scriptSetupMacroConfig).length > 0) {
    configObj = mergeJson(configObj ?? {}, scriptSetupMacroConfig, 'macro')
  }

  if (configObj && Object.keys(configObj).length > 0) {
    result.config = JSON.stringify(configObj, null, 2)
  }
}
