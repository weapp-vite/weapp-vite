import type { MutableCompilerContext } from '../../../context'
import type { ComponentPropMap } from '../../componentProps'
import type { ComponentMetadata } from '../metadata'
import type { LocalAutoImportMatch } from '../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import fs from 'fs-extra'
import pm from 'picomatch'
import { logger, resolvedComponentName } from '../../../context/shared'
import { extractConfigFromVue, findJsEntry, findJsonEntry, findTemplateEntry, findVueEntry } from '../../../utils'
import { extractComponentProps } from '../../componentProps'
import { requireConfigService } from '../../utils/requireConfigService'
import { getAutoImportConfig, getHtmlCustomDataSettings, getTypedComponentsSettings, getVueComponentsSettings } from '../config'
import { extractJsonPropMetadata, mergePropMaps } from '../metadata'

export interface RegistryHelpers {
  registerLocalComponent: (filePath: string) => Promise<void>
  removeRegisteredComponent: (paths: {
    baseName?: string
    templatePath?: string
    jsEntry?: string
    jsonPath?: string
  }) => { removed: boolean, removedNames: string[] }
  ensureMatcher: () => ((input: string) => boolean) | undefined
}

interface RegistryState {
  ctx: MutableCompilerContext
  registry: Map<string, LocalAutoImportMatch>
  autoImportState: MutableCompilerContext['runtimeState']['autoImport']
  resolverComponentNames: Set<string>
  componentMetadataMap: Map<string, ComponentMetadata>
  logWarnOnce: (message: string) => void
  scheduleManifestWrite: (shouldWrite: boolean) => void
  scheduleTypedComponentsWrite: (shouldWrite: boolean) => void
  scheduleHtmlCustomDataWrite: (shouldWrite: boolean) => void
  scheduleVueComponentsWrite: (shouldWrite: boolean) => void
}

export function createRegistryHelpers(state: RegistryState): RegistryHelpers {
  async function extractComponentPropsFromVue(vuePath: string): Promise<ComponentPropMap> {
    const source = await fs.readFile(vuePath, 'utf8')
    const { compileVueFile } = await import('wevu/compiler')
    const compiled = await compileVueFile(source, vuePath, {
      json: {
        kind: 'component',
      },
    })

    if (!compiled.script) {
      return new Map()
    }

    return extractComponentProps(compiled.script)
  }

  function removeRegisteredComponent(paths: {
    baseName?: string
    templatePath?: string
    jsEntry?: string
    jsonPath?: string
  }) {
    const { baseName, templatePath, jsEntry, jsonPath } = paths
    let removed = false
    const removedNames: string[] = []
    for (const [key, value] of state.registry) {
      if (value.kind !== 'local') {
        continue
      }
      const entry = value.entry
      const matches = Boolean(
        (templatePath && entry.templatePath === templatePath)
        || (jsonPath && entry.jsonPath === jsonPath)
        || (jsEntry && entry.path === jsEntry)
        || (baseName && removeExtensionDeep(entry.templatePath) === baseName)
        || (baseName && removeExtensionDeep(entry.path) === baseName)
        || (baseName && removeExtensionDeep(entry.jsonPath ?? '') === baseName),
      )

      if (matches) {
        if (state.registry.delete(key)) {
          removed = true
          removedNames.push(key)
        }
      }
    }

    return { removed, removedNames }
  }

  async function registerLocalComponent(filePath: string) {
    if (!state.ctx.configService || !state.ctx.jsonService) {
      throw new Error('扫描组件前必须初始化 configService/jsonService。')
    }

    const baseName = removeExtensionDeep(filePath)
    const [{ path: jsEntry }, { path: jsonPath }, { path: templatePath }, vueEntry] = await Promise.all([
      findJsEntry(baseName),
      findJsonEntry(baseName),
      findTemplateEntry(baseName),
      filePath.endsWith('.vue') ? Promise.resolve(filePath) : findVueEntry(baseName),
    ])

    const { removed, removedNames } = removeRegisteredComponent({
      baseName,
      templatePath,
      jsEntry,
      jsonPath,
    })

    for (const name of removedNames) {
      if (state.resolverComponentNames.has(name)) {
        state.componentMetadataMap.set(name, { types: new Map(), docs: new Map() })
      }
      else {
        state.componentMetadataMap.delete(name)
      }
    }

    let resolvedJsEntry = jsEntry
    let resolvedJsonPath = jsonPath
    let resolvedTemplatePath = templatePath
    let json = jsonPath ? await state.ctx.jsonService.read(jsonPath) : undefined

    if ((!resolvedJsEntry || !resolvedJsonPath || !resolvedTemplatePath) && vueEntry) {
      const vueConfig = await extractConfigFromVue(vueEntry)
      const vueJson = (vueConfig && typeof vueConfig === 'object' && !Array.isArray(vueConfig))
        ? { ...vueConfig }
        : {}
      if (vueJson.component !== false) {
        vueJson.component = true
        resolvedJsEntry = resolvedJsEntry ?? vueEntry
        resolvedJsonPath = resolvedJsonPath ?? vueEntry
        resolvedTemplatePath = resolvedTemplatePath ?? vueEntry
        json = vueJson
      }
    }

    if (!resolvedJsEntry || !resolvedJsonPath || !resolvedTemplatePath) {
      state.scheduleManifestWrite(removed)
      state.scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      state.scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      state.scheduleVueComponentsWrite(getVueComponentsSettings(state.ctx).enabled || removed || removedNames.length > 0)
      return
    }

    if (!json?.component) {
      state.scheduleManifestWrite(removed)
      state.scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      state.scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      state.scheduleVueComponentsWrite(getVueComponentsSettings(state.ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const { componentName, base } = resolvedComponentName(baseName)
    if (!componentName) {
      state.scheduleManifestWrite(removed)
      state.scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      state.scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      state.scheduleVueComponentsWrite(getVueComponentsSettings(state.ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const hasComponent = state.registry.has(componentName)
    if (hasComponent && base !== 'index') {
      const message = `发现 \`${componentName}\` 组件重名! 跳过组件 \`${state.ctx.configService.relativeCwd(baseName)}\` 的自动引入`
      state.logWarnOnce(message)
      state.scheduleManifestWrite(removed)
      state.scheduleTypedComponentsWrite(removed || removedNames.length > 0)
      state.scheduleHtmlCustomDataWrite(removed || removedNames.length > 0)
      state.scheduleVueComponentsWrite(getVueComponentsSettings(state.ctx).enabled || removed || removedNames.length > 0)
      return
    }

    const sourceWithoutExt = removeExtensionDeep(resolvedJsonPath)
    const from = `/${state.ctx.configService.relativeSrcRoot(
      state.ctx.configService.relativeCwd(sourceWithoutExt),
    )}`

    state.registry.set(componentName, {
      kind: 'local',
      entry: {
        path: resolvedJsEntry,
        json,
        jsonPath: resolvedJsonPath,
        type: 'component',
        templatePath: resolvedTemplatePath,
      },
      value: {
        name: componentName,
        from,
      },
    })

    state.scheduleManifestWrite(true)

    const typedSettings = getTypedComponentsSettings(state.ctx)
    const htmlSettings = getHtmlCustomDataSettings(state.ctx)
    const vueSettings = getVueComponentsSettings(state.ctx)
    const shouldCollectProps = typedSettings.enabled || htmlSettings.enabled

    if (shouldCollectProps) {
      let metadataSource: Record<string, any> | undefined = json
      try {
        if (/\.(?:json|jsonc|json5)$/i.test(resolvedJsonPath)) {
          metadataSource = await fs.readJson(resolvedJsonPath)
        }
      }
      catch {
        // 忽略读取失败，回退到 jsonService 提供的 json
      }

      const metadata = extractJsonPropMetadata(metadataSource)
      const baseProps = metadata.props
      let propMap: ComponentPropMap = new Map(baseProps)

      if (typedSettings.enabled) {
        try {
          const props = resolvedJsEntry.endsWith('.vue')
            ? await extractComponentPropsFromVue(resolvedJsEntry)
            : extractComponentProps(await fs.readFile(resolvedJsEntry, 'utf8'))
          propMap = mergePropMaps(baseProps, props)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(`解析组件 \`${state.ctx.configService.relativeCwd(resolvedJsEntry)}\` 属性失败: ${message}`)
          propMap = new Map(baseProps)
        }
      }

      state.componentMetadataMap.set(componentName, {
        types: new Map(propMap),
        docs: new Map(metadata.docs),
      })
    }
    else {
      state.componentMetadataMap.delete(componentName)
    }

    state.scheduleTypedComponentsWrite(typedSettings.enabled || removed || removedNames.length > 0)
    state.scheduleHtmlCustomDataWrite(htmlSettings.enabled || removed || removedNames.length > 0)
    state.scheduleVueComponentsWrite(vueSettings.enabled || removed || removedNames.length > 0)
  }

  function ensureMatcher() {
    const configService = requireConfigService(state.ctx, '过滤组件前必须初始化 configService。')
    const globs = getAutoImportConfig(configService)?.globs
    if (!globs || globs.length === 0) {
      state.autoImportState.matcher = undefined
      state.autoImportState.matcherKey = ''
      return undefined
    }

    const nextKey = globs.join('\0')
    if (!state.autoImportState.matcher || state.autoImportState.matcherKey !== nextKey) {
      state.autoImportState.matcher = pm(globs, {
        cwd: configService.cwd,
        windows: true,
        posixSlashes: true,
      })
      state.autoImportState.matcherKey = nextKey
    }

    return state.autoImportState.matcher
  }

  return {
    registerLocalComponent,
    removeRegisteredComponent,
    ensureMatcher,
  }
}
