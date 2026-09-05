import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { WevuRuntimeCapabilityMetadata } from '../../../../runtimeCapabilities'
import type { WevuBindingManifestV1 } from '../../../../types/bindingManifest'
import type { CompilerDiagnostic } from '../../../../types/diagnostics'
import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import type { TemplateCompileResult } from '../../compiler/template'
import type { ComponentSourceInfo } from './componentSources'
import type { AutoUsingComponentsOptions, CompileVueFileOptions } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { compileScript } from 'vue/compiler-sfc'
import { createWevuRuntimeCapabilityMetadataFromBindingManifest } from '../../../../runtimeCapabilities'
import { parseJsLike, traverse } from '../../../../utils/babel'
import { composeSourceMaps } from '../../../../utils/sourcemap'
import { createJsxDiagnostics } from '../../../jsx/compileJsx/diagnostics'
import { injectDynamicIslandRuntime, stripRenderOptionFromScript } from '../../../jsx/compileJsx/script'
import { compileJsxTemplateAndCollectComponents } from '../../../jsx/compileJsx/template'
import { transformVueJsxScript } from '../../../jsx/vueJsxTransform'
import { getMiniProgramTemplatePlatform } from '../../compiler/template'
import { stripJsonMacroCallsFromCode } from '../jsonMacros'
import { generateScopedId } from '../scopedId'
import { transformScript } from '../script'
import { remapJsxBindingManifestLocations } from './bindingManifestLocations'
import { applyCompilerTemplateWrappers } from './pageLayout'
import { warnReservedScriptSetupProps } from './reservedProps'

const TYPE_ONLY_DEFINE_PROPS_RE = /\bdefineProps\s*</
const EXPORT_DEFAULT_RE = /\bexport\s+default\b/

export interface ScriptPhaseResult {
  script?: string
  scriptMap?: EncodedSourceMapLike | null
  template?: string
  diagnostics?: CompilerDiagnostic[]
  bindingManifest?: WevuBindingManifestV1
  inlineExpressions?: TemplateCompileResult['inlineExpressions']
  /** @internal */
  runtimeCapabilities?: WevuRuntimeCapabilityMetadata
  autoUsingComponentsMap: Record<string, string>
  autoComponentMeta: Record<string, string>
}

export interface PrecomputedScriptPhaseInfo {
  propsAliases?: Record<string, string>
  propsDerivedKeys?: string[]
  cssModules?: Record<string, Record<string, string>>
}

type SfcDescriptor = Parameters<typeof compileScript>[0]
type CompiledScript = ReturnType<typeof compileScript>

function hasDefaultExport(scriptCode: string) {
  if (!EXPORT_DEFAULT_RE.test(scriptCode)) {
    return false
  }

  try {
    const ast = parseJsLike(scriptCode)
    let found = false
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        found = true
        path.stop()
      },
    })
    return found
  }
  catch {
    return EXPORT_DEFAULT_RE.test(scriptCode)
  }
}

export function resolveScriptSetupPropsAliases(bindings: Record<string, any> | undefined) {
  const aliases = bindings?.__propsAliases
  if (!aliases || typeof aliases !== 'object') {
    return undefined
  }
  const resolved: Record<string, string> = {}
  for (const [alias, propName] of Object.entries(aliases)) {
    if (typeof propName === 'string' && propName.length > 0) {
      resolved[alias] = propName
    }
  }
  return Object.keys(resolved).length ? resolved : undefined
}

export function resolveScriptSetupPropsDerivedKeys(bindings: Record<string, any> | undefined) {
  const keys = new Set<string>()
  for (const [key, bindingType] of Object.entries(bindings ?? {})) {
    if (
      key.startsWith('__')
      || (
        bindingType !== 'props'
        && bindingType !== 'props-aliased'
      )
    ) {
      continue
    }
    keys.add(key)
  }
  return keys.size ? [...keys] : undefined
}

function bindingsMayContainProps(bindings: Record<string, any> | undefined, scriptCode: string) {
  for (const [key, bindingType] of Object.entries(bindings ?? {})) {
    if (
      key === '__propsAliases'
      || bindingType === 'props'
      || bindingType === 'props-aliased'
    ) {
      return true
    }
  }
  return scriptCode.includes('__props') || scriptCode.includes('props:')
}

function hasPrecomputedScriptPhaseInfo<Key extends keyof PrecomputedScriptPhaseInfo>(
  info: PrecomputedScriptPhaseInfo | undefined,
  key: Key,
): info is PrecomputedScriptPhaseInfo & Required<Pick<PrecomputedScriptPhaseInfo, Key>> {
  return Boolean(info) && Object.prototype.hasOwnProperty.call(info, key)
}

function collectScriptSetupReturnInfo(scriptCode: string) {
  const keys = new Set<string>()
  const propsObjectAliases = new Set<string>(['__props'])
  const propsRefsAliases = new Set<string>()
  const destructuredPropsKeys = new Set<string>()

  const addObjectPatternKeys = (pattern: t.ObjectPattern) => {
    for (const property of pattern.properties) {
      if (!t.isObjectProperty(property)) {
        continue
      }
      if (t.isIdentifier(property.value)) {
        destructuredPropsKeys.add(property.value.name)
      }
      else if (t.isAssignmentPattern(property.value) && t.isIdentifier(property.value.left)) {
        destructuredPropsKeys.add(property.value.left.name)
      }
    }
  }

  try {
    const ast = parseJsLike(scriptCode)
    traverse(ast, {
      VariableDeclarator(path) {
        const init = path.node.init
        if (t.isIdentifier(path.node.id) && t.isIdentifier(init) && propsObjectAliases.has(init.name)) {
          propsObjectAliases.add(path.node.id.name)
          return
        }
        if (
          t.isIdentifier(path.node.id)
          && t.isCallExpression(init)
          && t.isIdentifier(init.callee, { name: 'toRefs' })
          && init.arguments.length === 1
          && t.isIdentifier(init.arguments[0])
          && propsObjectAliases.has(init.arguments[0].name)
        ) {
          propsRefsAliases.add(path.node.id.name)
          return
        }
        if (!t.isObjectPattern(path.node.id)) {
          return
        }
        if (t.isIdentifier(init) && propsObjectAliases.has(init.name)) {
          addObjectPatternKeys(path.node.id)
          return
        }
        if (
          t.isIdentifier(init)
          && propsRefsAliases.has(init.name)
        ) {
          addObjectPatternKeys(path.node.id)
          return
        }
        if (
          t.isCallExpression(init)
          && t.isIdentifier(init.callee, { name: 'toRefs' })
          && init.arguments.length === 1
          && t.isIdentifier(init.arguments[0])
          && propsObjectAliases.has(init.arguments[0].name)
        ) {
          addObjectPatternKeys(path.node.id)
        }
      },
      ObjectProperty(path) {
        const objectPath = path.parentPath
        if (
          !objectPath.isObjectExpression()
          || !objectPath.parentPath.isVariableDeclarator()
          || !t.isIdentifier(objectPath.parentPath.node.id, { name: '__returned__' })
        ) {
          return
        }
        const prop = path.node
        if (prop.computed) {
          return
        }
        if (t.isIdentifier(prop.key)) {
          keys.add(prop.key.name)
        }
        else if (t.isStringLiteral(prop.key)) {
          keys.add(prop.key.value)
        }
      },
    })
  }
  catch {
    return {
      returnedKeys: keys,
      destructuredPropsKeys,
    }
  }
  return {
    returnedKeys: keys,
    destructuredPropsKeys,
  }
}

export function resolveEffectivePropsDerivedKeys(
  bindings: Record<string, any> | undefined,
  scriptCode: string,
) {
  if (!bindingsMayContainProps(bindings, scriptCode)) {
    return undefined
  }

  const directKeys = resolveScriptSetupPropsDerivedKeys(bindings) ?? []
  const { returnedKeys, destructuredPropsKeys } = collectScriptSetupReturnInfo(scriptCode)
  const aliases = resolveScriptSetupPropsAliases(bindings) ?? {}
  const propsKeys = new Set(
    Object.entries(bindings ?? {})
      .filter(([key, bindingType]) => key && !key.startsWith('__') && bindingType === 'props')
      .map(([key]) => key),
  )
  const keys = new Set<string>()

  for (const key of directKeys) {
    keys.add(key)
  }
  for (const key of destructuredPropsKeys) {
    keys.add(key)
  }
  for (const [alias, propName] of Object.entries(aliases)) {
    if (!returnedKeys.has(alias)) {
      keys.add(alias)
    }
    if (propsKeys.has(propName) && !returnedKeys.has(propName)) {
      keys.add(propName)
    }
  }
  for (const key of propsKeys) {
    if (!returnedKeys.has(key)) {
      keys.add(key)
    }
  }

  return keys.size ? [...keys] : undefined
}

export async function compileScriptPhase(
  descriptor: Pick<SFCDescriptor, 'scriptSetup' | 'template' | 'script'>,
  descriptorForCompile: SfcDescriptor,
  filename: string,
  options: CompileVueFileOptions | undefined,
  _autoUsingComponents: AutoUsingComponentsOptions | undefined,
  templateCompiled: TemplateCompileResult | undefined,
  isAppFile: boolean,
  componentSourceInfo?: ComponentSourceInfo,
  precompiledScript?: CompiledScript,
  precomputedScriptPhaseInfo?: PrecomputedScriptPhaseInfo,
  originalSource?: string,
): Promise<ScriptPhaseResult> {
  const autoUsingComponentsMap: Record<string, string> = { ...(componentSourceInfo?.autoUsingComponentsMap ?? {}) }
  const autoComponentMeta: Record<string, string> = { ...(componentSourceInfo?.autoComponentMeta ?? {}) }
  const relaxStructuredTypeOnlyProps = Boolean(
    descriptor.scriptSetup?.content
    && TYPE_ONLY_DEFINE_PROPS_RE.test(descriptor.scriptSetup.content),
  )

  let scriptCode: string | undefined
  let compiledScriptForMap: CompiledScript | undefined
  let scriptMap: EncodedSourceMapLike | null = null
  let propsAliases = options?.template?.propsAliases
  let propsDerivedKeys: string[] | undefined
  let jsxDiagnostics: CompilerDiagnostic[] | undefined
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = precompiledScript ?? compileScript(descriptorForCompile, {
      id: generateScopedId(filename),
      isProd: false,
    })
    compiledScriptForMap = scriptCompiled
    warnReservedScriptSetupProps(descriptorForCompile.scriptSetup?.content, options?.warn, {
      filename,
      scriptSetupStart: descriptorForCompile.scriptSetup?.loc.start,
    })
    if (!propsAliases && hasPrecomputedScriptPhaseInfo(precomputedScriptPhaseInfo, 'propsAliases')) {
      propsAliases = precomputedScriptPhaseInfo.propsAliases
    }
    propsAliases ??= resolveScriptSetupPropsAliases(scriptCompiled.bindings as Record<string, any> | undefined)

    scriptCode = scriptCompiled.content
    propsDerivedKeys = hasPrecomputedScriptPhaseInfo(precomputedScriptPhaseInfo, 'propsDerivedKeys')
      ? precomputedScriptPhaseInfo.propsDerivedKeys
      : resolveEffectivePropsDerivedKeys(scriptCompiled.bindings as Record<string, any> | undefined, scriptCode)
    scriptMap = options?.sourceMap !== false && scriptCompiled.map && typeof scriptCompiled.map === 'object'
      ? scriptCompiled.map
      : null

    if (
      scriptCode.includes('defineAppJson')
      || scriptCode.includes('definePageJson')
      || scriptCode.includes('defineComponentJson')
    ) {
      scriptCode = stripJsonMacroCallsFromCode(scriptCode, filename)
    }

    if (!isAppFile && !descriptor.scriptSetup && !hasDefaultExport(scriptCode)) {
      scriptCode += '\nexport default {}'
    }
  }
  else {
    scriptCode = 'export default {}'
  }

  if (scriptCode) {
    const scriptLang = descriptor.script?.lang ?? descriptor.scriptSetup?.lang
    const isJsxScript = scriptLang === 'jsx' || scriptLang === 'tsx'
    let jsxTemplate: ReturnType<typeof compileJsxTemplateAndCollectComponents> | undefined
    if (isJsxScript) {
      jsxTemplate = compileJsxTemplateAndCollectComponents(scriptCode, filename, options)
      const externalScriptBlock = descriptor.script?.src
        ? descriptor.script
        : descriptor.scriptSetup?.src
          ? descriptor.scriptSetup
          : undefined
      remapJsxBindingManifestLocations(
        jsxTemplate.bindingManifest,
        compiledScriptForMap?.map,
        externalScriptBlock?.content ?? originalSource,
        externalScriptBlock?.src,
      )
      if (jsxTemplate.template && (options?.pageLayout || options?.appShell)) {
        jsxTemplate.template = applyCompilerTemplateWrappers({
          template: jsxTemplate.template,
          manifest: jsxTemplate.bindingManifest,
          platform: options?.template?.platform ?? getMiniProgramTemplatePlatform(),
          pageLayout: options?.pageLayout,
          appShell: options?.appShell,
        })
      }
      const reportJsxWarnings = !descriptor.template || Boolean(jsxTemplate.template)
      scriptCode = injectDynamicIslandRuntime(
        stripRenderOptionFromScript(
          scriptCode,
          filename,
          reportJsxWarnings ? jsxTemplate.warnings : undefined,
        ),
        jsxTemplate.dynamicIslands,
      )
      if (reportJsxWarnings && jsxTemplate.warnings.length) {
        jsxDiagnostics = createJsxDiagnostics(jsxTemplate.warnings, filename)
        if (options?.warn) {
          jsxDiagnostics.forEach(diagnostic => options.warn?.(diagnostic.message))
        }
      }
    }
    const jsxTransformed = isJsxScript
      ? transformVueJsxScript(scriptCode, filename, options?.sourceMap !== false)
      : { code: scriptCode, map: null }
    const bindingManifest = jsxTemplate?.template
      ? jsxTemplate.bindingManifest
      : templateCompiled?.bindingManifest
    const effectiveInlineExpressions = jsxTemplate?.template
      ? jsxTemplate.inlineExpressions
      : templateCompiled?.inlineExpressions
    const runtimeCapabilities = bindingManifest
      ? createWevuRuntimeCapabilityMetadataFromBindingManifest(bindingManifest)
      : templateCompiled?.runtimeCapabilities
    const transformed = transformScript(jsxTransformed.code, {
      isTypeScript: descriptor.script?.lang === 'ts'
        || descriptor.script?.lang === 'tsx'
        || descriptor.scriptSetup?.lang === 'ts'
        || descriptor.scriptSetup?.lang === 'tsx',
      skipComponentTransform: options?.skipComponentTransform ?? isAppFile,
      isApp: isAppFile,
      isPage: options?.isPage === true,
      minify: options?.minify,
      sourceMap: options?.sourceMap,
      warn: options?.warn,
      templateComponentMeta: Object.keys(autoComponentMeta).length ? autoComponentMeta : undefined,
      wevuDefaults: options?.wevuDefaults,
      classStyleRuntime: templateCompiled?.classStyleRuntime,
      classStyleBindings: templateCompiled?.classStyleBindings,
      templateRefs: templateCompiled?.templateRefs,
      layoutHosts: templateCompiled?.layoutHosts,
      inlineExpressions: effectiveInlineExpressions,
      bindingManifest: isAppFile ? undefined : bindingManifest,
      autoSetDataPick: !isAppFile && options?.autoSetDataPick,
      runtimeBindingManifest: options?.runtimeBindingManifest,
      pageLayout: isAppFile ? undefined : options?.pageLayout,
      runtimeCapabilities,
      functionPropPaths: templateCompiled?.functionPropPaths,
      propsAliases,
      propsDerivedKeys,
      cssModules: precomputedScriptPhaseInfo?.cssModules,
      relaxStructuredTypeOnlyProps,
      scopedSlotHostProperties: !isAppFile
        && options?.isPage !== true
        && Boolean(
          templateCompiled?.hasSlotOutlet
          || (templateCompiled?.componentGenerics && Object.keys(templateCompiled.componentGenerics).length > 0),
        ),
    })
    return {
      script: transformed.code,
      scriptMap: composeSourceMaps(transformed.map ?? jsxTransformed.map, scriptMap),
      template: jsxTemplate?.template,
      diagnostics: jsxDiagnostics,
      bindingManifest,
      inlineExpressions: jsxTemplate?.inlineExpressions,
      runtimeCapabilities: transformed.runtimeCapabilities,
      autoUsingComponentsMap,
      autoComponentMeta,
    }
  }

  return { script: scriptCode, scriptMap: null, autoUsingComponentsMap, autoComponentMeta }
}
