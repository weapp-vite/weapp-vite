import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import type { TemplateCompileResult } from '../../compiler/template'
import type { ComponentSourceInfo } from './componentSources'
import type { AutoUsingComponentsOptions, CompileVueFileOptions } from './types'
import { compileScript } from 'vue/compiler-sfc'
import { composeSourceMaps } from '../../../../utils/sourcemap'
import { stripJsonMacroCallsFromCode } from '../jsonMacros'
import { transformScript } from '../script'

const TYPE_ONLY_DEFINE_PROPS_RE = /\bdefineProps\s*</

export interface ScriptPhaseResult {
  script?: string
  scriptMap?: EncodedSourceMapLike | null
  autoUsingComponentsMap: Record<string, string>
  autoComponentMeta: Record<string, string>
}

type SfcDescriptor = Parameters<typeof compileScript>[0]

export async function compileScriptPhase(
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template' | 'script'>,
  descriptorForCompile: SfcDescriptor,
  filename: string,
  options: CompileVueFileOptions | undefined,
  _autoUsingComponents: AutoUsingComponentsOptions | undefined,
  templateCompiled: TemplateCompileResult | undefined,
  isAppFile: boolean,
  componentSourceInfo?: ComponentSourceInfo,
): Promise<ScriptPhaseResult> {
  const autoUsingComponentsMap: Record<string, string> = { ...(componentSourceInfo?.autoUsingComponentsMap ?? {}) }
  const autoComponentMeta: Record<string, string> = { ...(componentSourceInfo?.autoComponentMeta ?? {}) }
  const relaxStructuredTypeOnlyProps = Boolean(
    descriptor.scriptSetup?.content
    && TYPE_ONLY_DEFINE_PROPS_RE.test(descriptor.scriptSetup.content),
  )

  let scriptCode: string | undefined
  let scriptMap: EncodedSourceMapLike | null = null
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = compileScript(descriptorForCompile, {
      id: filename,
      isProd: false,
    })

    scriptCode = scriptCompiled.content
    scriptMap = scriptCompiled.map && typeof scriptCompiled.map === 'object'
      ? scriptCompiled.map
      : null

    if (
      scriptCode.includes('defineAppJson')
      || scriptCode.includes('definePageJson')
      || scriptCode.includes('defineComponentJson')
    ) {
      scriptCode = stripJsonMacroCallsFromCode(scriptCode, filename)
    }

    if (!isAppFile && !scriptCode.includes('export default')) {
      scriptCode += '\nexport default {}'
    }
  }
  else {
    scriptCode = 'export default {}'
  }

  if (scriptCode) {
    const transformed = transformScript(scriptCode, {
      skipComponentTransform: isAppFile,
      isApp: isAppFile,
      isPage: options?.isPage === true,
      warn: options?.warn,
      templateComponentMeta: Object.keys(autoComponentMeta).length ? autoComponentMeta : undefined,
      wevuDefaults: options?.wevuDefaults,
      classStyleRuntime: templateCompiled?.classStyleRuntime,
      classStyleBindings: templateCompiled?.classStyleBindings,
      templateRefs: templateCompiled?.templateRefs,
      layoutHosts: templateCompiled?.layoutHosts,
      inlineExpressions: templateCompiled?.inlineExpressions,
      relaxStructuredTypeOnlyProps,
    })
    return {
      script: transformed.code,
      scriptMap: composeSourceMaps(transformed.map ?? null, scriptMap),
      autoUsingComponentsMap,
      autoComponentMeta,
    }
  }

  return { script: scriptCode, scriptMap: null, autoUsingComponentsMap, autoComponentMeta }
}
