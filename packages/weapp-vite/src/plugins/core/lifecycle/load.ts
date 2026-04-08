import type { CorePluginState, IndependentBuildResult } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { mayContainPlatformApiAccess, platformApiIdentifiers, resolveAstEngine } from '../../../ast'
import logger from '../../../logger'
import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveInjectRequestGlobalsOptions,
  resolveManualRequestGlobalsTargets,
} from '../../../runtime/config/internal/injectRequestGlobals'
import { resolveWeappLibEntries } from '../../../runtime/lib'
import { findJsEntry, findVueEntry, isCSSRequest } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { getMiniProgramPlatformGlobalKey } from '../../../utils/miniProgramGlobals'
import { normalizeWatchPath } from '../../../utils/path'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createNativeApiFallbackExpression, createWeapiAccessExpression, createWeapiHostExpression } from '../../../utils/weapi'
import { readFile as readFileCached } from '../../utils/cache'
import { getCssRealPath, parseRequest } from '../../utils/parse'

export function createOptionsHook(state: CorePluginState) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService, buildService } = ctx

  async function resolvePluginOnlyInput() {
    const pluginJson = scanService.pluginJson
    const pluginJsonPath = scanService.pluginJsonPath
    const pluginMain = typeof pluginJson?.main === 'string' ? pluginJson.main.trim() : ''
    if (!pluginJsonPath || !pluginMain) {
      throw new Error('插件独立构建需要在 plugin.json 中声明有效的 main 入口。')
    }

    const pluginEntryBase = path.resolve(path.dirname(pluginJsonPath), removeExtensionDeep(pluginMain))
    const { path: pluginEntryPath } = await findJsEntry(pluginEntryBase)
    const pluginVueEntryPath = pluginEntryPath ? undefined : await findVueEntry(pluginEntryBase)
    const resolvedPath = pluginEntryPath ?? pluginVueEntryPath

    if (!resolvedPath) {
      throw new Error(`未找到插件主入口 ${pluginMain} 对应的脚本文件。`)
    }

    return {
      [removeExtensionDeep(pluginMain)]: resolvedPath,
    }
  }

  return async function options(options: any) {
    state.pendingIndependentBuilds = []
    let scannedInput: Record<string, string>

    if (subPackageMeta) {
      scannedInput = subPackageMeta.entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry] = path.resolve(configService.absoluteSrcRoot, entry)
        return acc
      }, {})
    }
    else if (configService.weappLibConfig?.enabled) {
      const libState = ctx.runtimeState.lib
      const entries = await resolveWeappLibEntries(configService, configService.weappLibConfig)
      const outputMap = new Map<string, string>()
      libState.entries.clear()

      scannedInput = entries.reduce<Record<string, string>>((acc, entry) => {
        acc[entry.name] = entry.input
        outputMap.set(entry.relativeBase, entry.outputBase)
        const normalized = normalizeFsResolvedId(entry.input)
        if (normalized) {
          libState.entries.set(normalized, entry)
        }
        return acc
      }, {})

      libState.enabled = true
      configService.options = {
        ...configService.options,
        weappLibOutputMap: outputMap,
      }
    }
    else {
      const libState = ctx.runtimeState.lib
      libState.enabled = false
      libState.entries.clear()
      if (configService.options.weappLibOutputMap) {
        configService.options = {
          ...configService.options,
          weappLibOutputMap: undefined,
        }
      }
      const appEntry = await scanService.loadAppEntry()
      if (configService.pluginOnly) {
        scannedInput = await resolvePluginOnlyInput()
      }
      else {
        scanService.loadSubPackages()
        const dirtyIndependentRoots = scanService.drainIndependentDirtyRoots()
        const pendingIndependentBuilds: Promise<IndependentBuildResult>[] = []
        // Serialize prod builds to avoid shared runtime state races.
        const shouldSerializeIndependentBuilds = !configService.isDev && dirtyIndependentRoots.length > 0
        const previousSubPackageRoot = shouldSerializeIndependentBuilds
          ? configService.currentSubPackageRoot
          : undefined
        for (const root of dirtyIndependentRoots) {
          const meta = scanService.independentSubPackageMap.get(root)
          if (!meta) {
            continue
          }
          const buildTask = buildService.buildIndependentBundle(root, meta).then((rollup) => {
            return {
              meta,
              rollup,
            }
          })
          buildTask.catch(() => {})
          pendingIndependentBuilds.push(buildTask)
          if (shouldSerializeIndependentBuilds) {
            try {
              await buildTask
            }
            catch {}
          }
        }
        if (shouldSerializeIndependentBuilds && configService.currentSubPackageRoot !== previousSubPackageRoot) {
          configService.options = {
            ...configService.options,
            currentSubPackageRoot: previousSubPackageRoot,
          }
        }
        state.pendingIndependentBuilds = pendingIndependentBuilds
        scannedInput = { app: appEntry.path }
      }
    }

    options.input = scannedInput
  }
}

export function createLoadHook(state: CorePluginState) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet } = state
  const { configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const weapiResolution = { checked: false, available: false }
  const injectRequestGlobalsOptions = resolveInjectRequestGlobalsOptions(
    configService.weappViteConfig?.injectRequestGlobals,
    configService.packageJson,
  )

  function resolveInjectWeapiOptions() {
    const injectWeapi = configService.weappViteConfig?.injectWeapi
    if (!injectWeapi) {
      return null
    }
    const enabled = typeof injectWeapi === 'object'
      ? injectWeapi.enabled === true
      : injectWeapi === true
    if (!enabled) {
      return null
    }
    const globalName = typeof injectWeapi === 'object' && injectWeapi.globalName
      ? injectWeapi.globalName
      : 'wpi'
    const replaceWx = typeof injectWeapi === 'object'
      ? injectWeapi.replaceWx === true
      : false
    return {
      globalName,
      replaceWx,
    }
  }

  function createWeapiInjectionCode(options: {
    globalName: string
    replaceWx: boolean
    platform: string
  }) {
    const globalKey = JSON.stringify(options.globalName)
    const platform = JSON.stringify(options.platform)
    const hostExpression = createWeapiHostExpression()
    const nativeApiFallbackExpression = createNativeApiFallbackExpression()
    const replaceLines = options.replaceWx
      ? [
          `  __weappGlobal.wx = __weappInstance`,
          `  __weappGlobal.my = __weappInstance`,
          `  if (__weappPlatformKey) {`,
          `    __weappGlobal[__weappPlatformKey] = __weappInstance`,
          `  }`,
          `  try {`,
          `    Function('__weappApi', 'wx = __weappApi; my = __weappApi;')(__weappInstance)`,
          `  }`,
          `  catch {}`,
        ]
      : []
    return [
      `import { wpi as __weappWpi } from '@wevu/api'`,
      `const __weappGlobal = ${hostExpression}`,
      `const __weappPlatformKey = ${platform}`,
      `if (__weappGlobal) {`,
      `  const __weappExistingWpi = __weappGlobal[${globalKey}]`,
      `  const __weappInstance = __weappExistingWpi || __weappWpi`,
      `  if (!__weappExistingWpi) {`,
      `    const __weappRawApi = ${nativeApiFallbackExpression} || (__weappPlatformKey ? __weappGlobal[__weappPlatformKey] : undefined) || __weappGlobal.wx || __weappGlobal.my`,
      `    if (__weappRawApi && __weappRawApi !== __weappWpi) {`,
      `      __weappWpi.setAdapter(__weappRawApi, __weappPlatformKey)`,
      `    }`,
      `    __weappGlobal[${globalKey}] = __weappWpi`,
      `  }`,
      ...replaceLines,
      `}`,
      '',
    ].join('\n')
  }

  function replacePlatformApiAccess(
    code: string,
    globalName: string,
    options?: {
      engine?: 'babel' | 'oxc'
      parserLike?: { parse?: (input: string, options?: unknown) => unknown }
    },
  ) {
    const injectedApiIdentifier = '__weappViteInjectedApi__'

    if (!mayContainPlatformApiAccess(code, options)) {
      return code
    }

    try {
      const ast = parseJsLike(code)
      let mutated = false

      const rewritePath = (path: any) => {
        const object = path.node?.object
        if (!object || object.type !== 'Identifier') {
          return
        }
        const identifierName = object.name
        if (!platformApiIdentifiers.has(identifierName)) {
          return
        }
        if (path.scope?.hasBinding?.(identifierName)) {
          return
        }
        path.node.object = {
          type: 'Identifier',
          name: injectedApiIdentifier,
        }
        mutated = true
      }

      traverse(ast as any, {
        MemberExpression: rewritePath,
        OptionalMemberExpression: rewritePath,
      })

      if (!mutated) {
        return code
      }

      const transformedCode = generate(ast as any).code
      const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
      return `${aliasCode}\n${transformedCode}`
    }
    catch {
      return code
    }
  }

  function replacePlatformApiInLoadResult(
    result: any,
    options: { replaceWx: boolean, globalName: string },
    parserLike?: { parse?: (input: string, options?: unknown) => unknown },
  ) {
    if (!options.replaceWx) {
      return result
    }
    if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string') {
      return result
    }
    const replacedCode = replacePlatformApiAccess(result.code, options.globalName, {
      engine: astEngine,
      parserLike,
    })
    if (replacedCode === result.code) {
      return result
    }
    return {
      ...result,
      code: replacedCode,
    }
  }

  function prependCodeToLoadResult(result: any, code: string) {
    if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string') {
      return result
    }

    return {
      ...result,
      code: `${code}${result.code}`,
    }
  }

  function resolveRequestGlobalsTargets() {
    if (!injectRequestGlobalsOptions) {
      return []
    }
    return injectRequestGlobalsOptions.targets
  }

  function resolvePassiveRequestGlobalsTargets(code: string) {
    if (resolveRequestGlobalsTargets().length > 0) {
      return []
    }
    return resolveManualRequestGlobalsTargets(code)
  }

  function injectRequestGlobalsIntoLoadResult(
    result: any,
    sourceId: string,
    targets: string[],
    options?: {
      localBindings?: boolean
      passiveLocalBindings?: boolean
    },
  ) {
    if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string' || targets.length === 0) {
      return result
    }

    if (sourceId.endsWith('.vue')) {
      return {
        ...result,
        code: injectRequestGlobalsIntoSfc(result.code, targets as any, options),
      }
    }

    return prependCodeToLoadResult(result, createInjectRequestGlobalsCode(targets as any, options))
  }

  async function ensureWeapiAvailable(pluginCtx: any, importer: string) {
    if (weapiResolution.checked) {
      return weapiResolution.available
    }
    weapiResolution.checked = true
    if (typeof pluginCtx?.resolve !== 'function') {
      weapiResolution.available = true
      return true
    }
    const resolved = await pluginCtx.resolve('@wevu/api', importer)
    if (!resolved) {
      logger.warn('[weapp-vite] 未找到 @wevu/api，已跳过 wpi 全局注入。')
      weapiResolution.available = false
      return false
    }
    weapiResolution.available = true
    return true
  }

  function resolveRootEntryBasename() {
    if (!configService.pluginOnly) {
      return 'app'
    }
    const pluginMain = typeof ctx.scanService?.pluginJson?.main === 'string'
      ? ctx.scanService.pluginJson.main.trim()
      : ''
    return pluginMain ? removeExtensionDeep(pluginMain) : 'app'
  }

  return async function load(this: any, id: string) {
    configService.weappViteConfig?.debug?.load?.(id, subPackageMeta)

    if (isCSSRequest(id)) {
      const parsed = parseRequest(id)
      if (parsed.query.wxss) {
        const realPath = getCssRealPath(parsed)
        this.addWatchFile(normalizeWatchPath(realPath))
        try {
          const css = await readFileCached(realPath, { checkMtime: configService.isDev })
          return { code: css }
        }
        catch {}
      }
      return null
    }

    const sourceId = normalizeFsResolvedId(id)
    const injectOptions = resolveInjectWeapiOptions()
    const libEntry = configService.weappLibConfig?.enabled
      ? ctx.runtimeState.lib.entries.get(sourceId)
      : undefined
    if (libEntry) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, 'component')
      const requestGlobalsTargets = resolveRequestGlobalsTargets()
      if (requestGlobalsTargets.length === 0) {
        return result
      }
      return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
        localBindings: true,
      })
    }
    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))

    if (relativeBasename === resolveRootEntryBasename()) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, 'app')
      const requestGlobalsTargets = resolveRequestGlobalsTargets()
      const passiveRequestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolvePassiveRequestGlobalsTargets((result as any).code)
        : []
      if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, passiveRequestGlobalsTargets, {
          passiveLocalBindings: true,
        })
      }
      if (!injectOptions || configService.weappLibConfig?.enabled) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets)
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets)
      }
      if (result && typeof result === 'object' && 'code' in result) {
        const requestGlobalsInjectedResult = injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets)
        const platform = getMiniProgramPlatformGlobalKey(configService.platform) ?? ''
        const injectedCode = createWeapiInjectionCode({
          globalName: injectOptions.globalName,
          replaceWx: injectOptions.replaceWx,
          platform,
        })
        return replacePlatformApiInLoadResult({
          ...(requestGlobalsInjectedResult as any),
          code: `${injectedCode}${(requestGlobalsInjectedResult as any).code}`,
        }, injectOptions, this)
      }
      return result
    }

    const declaredEntryType = state.entriesMap?.get(relativeBasename)?.type
    const isDeclaredEntry = Boolean(declaredEntryType)

    if (loadedEntrySet.has(sourceId) || isDeclaredEntry || subPackageMeta?.entries.includes(relativeBasename)) {
      const loadType = declaredEntryType === 'page' ? 'page' : 'component'
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, loadType)
      const requestGlobalsTargets = resolveRequestGlobalsTargets()
      const passiveRequestGlobalsTargets = result && typeof result === 'object' && 'code' in result
        ? resolvePassiveRequestGlobalsTargets((result as any).code)
        : []
      if (requestGlobalsTargets.length === 0 && passiveRequestGlobalsTargets.length > 0) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, passiveRequestGlobalsTargets, {
          passiveLocalBindings: true,
        })
      }
      if (!injectOptions || !injectOptions.replaceWx || configService.weappLibConfig?.enabled) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return injectRequestGlobalsIntoLoadResult(result, sourceId, requestGlobalsTargets, {
          localBindings: true,
        })
      }
      return injectRequestGlobalsIntoLoadResult(
        replacePlatformApiInLoadResult(result, injectOptions, this),
        sourceId,
        requestGlobalsTargets,
        {
          localBindings: true,
        },
      )
    }
  }
}
