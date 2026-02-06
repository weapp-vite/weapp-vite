import type { CorePluginState, IndependentBuildResult } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import logger from '../../../logger'
import { resolveWeappLibEntries } from '../../../runtime/lib'
import { isCSSRequest } from '../../../utils'
import { generate, parseJsLike, traverse } from '../../../utils/babel'
import { normalizeWatchPath } from '../../../utils/path'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createWeapiAccessExpression, createWeapiHostExpression } from '../../../utils/weapi'
import { readFile as readFileCached } from '../../utils/cache'
import { getCssRealPath, parseRequest } from '../../utils/parse'

export function createOptionsHook(state: CorePluginState) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService, buildService } = ctx

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

    options.input = scannedInput
  }
}

export function createLoadHook(state: CorePluginState) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet } = state
  const { configService } = ctx
  const weapiResolution = { checked: false, available: false }

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

  function resolveWeapiPlatform(platform: string) {
    const platformMap: Record<string, string> = {
      weapp: 'wx',
      alipay: 'my',
      tt: 'tt',
      swan: 'swan',
      jd: 'jd',
      xhs: 'xhs',
    }
    return platformMap[platform] ?? platform
  }

  function createWeapiInjectionCode(options: {
    globalName: string
    replaceWx: boolean
    platform: string
  }) {
    const globalKey = JSON.stringify(options.globalName)
    const platform = JSON.stringify(options.platform)
    const hostExpression = createWeapiHostExpression()
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
      `    const __weappRawPlatformApi = __weappPlatformKey ? __weappGlobal[__weappPlatformKey] : undefined`,
      `    const __weappRawWx = __weappGlobal.wx`,
      `    const __weappRawMy = __weappGlobal.my`,
      `    const __weappRawApi = __weappRawPlatformApi || __weappRawWx || __weappRawMy`,
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

  function replacePlatformApiAccess(code: string, globalName: string) {
    const platformApiIdentifiers = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])
    const injectedApiIdentifier = '__weappViteInjectedApi__'

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

  function replacePlatformApiInLoadResult(result: any, options: { replaceWx: boolean, globalName: string }) {
    if (!options.replaceWx) {
      return result
    }
    if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string') {
      return result
    }
    const replacedCode = replacePlatformApiAccess(result.code, options.globalName)
    if (replacedCode === result.code) {
      return result
    }
    return {
      ...result,
      code: replacedCode,
    }
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
      return await loadEntry.call(this, sourceId, 'component')
    }
    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))

    if (relativeBasename === 'app') {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, 'app')
      if (!injectOptions || configService.weappLibConfig?.enabled) {
        return result
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return result
      }
      if (result && typeof result === 'object' && 'code' in result) {
        const platform = resolveWeapiPlatform(configService.platform)
        const injectedCode = createWeapiInjectionCode({
          globalName: injectOptions.globalName,
          replaceWx: injectOptions.replaceWx,
          platform,
        })
        return replacePlatformApiInLoadResult({
          ...result,
          code: `${injectedCode}${result.code}`,
        }, injectOptions)
      }
      return result
    }

    if (loadedEntrySet.has(sourceId) || subPackageMeta?.entries.includes(relativeBasename)) {
      // @ts-ignore Rolldown 的 PluginContext 类型不完整
      const result = await loadEntry.call(this, sourceId, 'component')
      if (!injectOptions || !injectOptions.replaceWx || configService.weappLibConfig?.enabled) {
        return result
      }
      const available = await ensureWeapiAvailable(this, sourceId)
      if (!available) {
        return result
      }
      return replacePlatformApiInLoadResult(result, injectOptions)
    }
  }
}
