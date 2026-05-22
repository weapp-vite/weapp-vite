import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { EncodedSourceMapLike } from '../../../../utils/sourcemap'
import type { TemplateCompileResult } from '../../compiler/template'
import type { ComponentSourceInfo } from './componentSources'
import type { AutoUsingComponentsOptions, CompileVueFileOptions } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { compileScript } from 'vue/compiler-sfc'
import { parseJsLike, traverse } from '../../../../utils/babel'
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
type CompiledScript = ReturnType<typeof compileScript>

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

function collectScriptSetupReturnInfo(scriptCode: string) {
  const keys = new Set<string>()
  const propsObjectAliases = new Set<string>(['__props'])
  const destructuredPropsKeys = new Set<string>()
  try {
    const ast = parseJsLike(scriptCode)
    traverse(ast, {
      VariableDeclarator(path) {
        const init = path.node.init
        if (t.isIdentifier(path.node.id) && t.isIdentifier(init) && propsObjectAliases.has(init.name)) {
          propsObjectAliases.add(path.node.id.name)
          return
        }
        if (!t.isObjectPattern(path.node.id) || !t.isIdentifier(init) || !propsObjectAliases.has(init.name)) {
          return
        }
        for (const property of path.node.id.properties) {
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
): Promise<ScriptPhaseResult> {
  const autoUsingComponentsMap: Record<string, string> = { ...(componentSourceInfo?.autoUsingComponentsMap ?? {}) }
  const autoComponentMeta: Record<string, string> = { ...(componentSourceInfo?.autoComponentMeta ?? {}) }
  const relaxStructuredTypeOnlyProps = Boolean(
    descriptor.scriptSetup?.content
    && TYPE_ONLY_DEFINE_PROPS_RE.test(descriptor.scriptSetup.content),
  )

  let scriptCode: string | undefined
  let scriptMap: EncodedSourceMapLike | null = null
  let propsAliases = options?.template?.propsAliases
  let propsDerivedKeys: string[] | undefined
  if (descriptor.script || descriptor.scriptSetup) {
    const scriptCompiled = precompiledScript ?? compileScript(descriptorForCompile, {
      id: filename,
      isProd: false,
    })
    propsAliases ??= resolveScriptSetupPropsAliases(scriptCompiled.bindings as Record<string, any> | undefined)

    scriptCode = scriptCompiled.content
    propsDerivedKeys = resolveEffectivePropsDerivedKeys(scriptCompiled.bindings as Record<string, any> | undefined, scriptCode)
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
      minify: options?.minify,
      warn: options?.warn,
      templateComponentMeta: Object.keys(autoComponentMeta).length ? autoComponentMeta : undefined,
      wevuDefaults: options?.wevuDefaults,
      classStyleRuntime: templateCompiled?.classStyleRuntime,
      classStyleBindings: templateCompiled?.classStyleBindings,
      templateRefs: templateCompiled?.templateRefs,
      layoutHosts: templateCompiled?.layoutHosts,
      inlineExpressions: templateCompiled?.inlineExpressions,
      functionPropPaths: templateCompiled?.functionPropPaths,
      propsAliases,
      propsDerivedKeys,
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
