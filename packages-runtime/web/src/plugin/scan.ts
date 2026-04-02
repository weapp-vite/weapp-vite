import type { ComponentEntry, PageEntry, ScanState, WarnFn } from './types'
import process from 'node:process'

import { dirname, extname, join, posix, relative, resolve } from 'pathe'
import { slugify } from '../shared/slugify'
import { isRecord, readJsonFile, resolveJsonPath, resolveScriptFile, resolveStyleFile, resolveTemplateFile } from './files'
import { mergeNavigationConfig, pickNavigationConfig } from './navigation'
import { normalizePath, toPosixId } from './path'
import { collectComponentTagsFromConfig, collectComponentTagsFromJson, mergeComponentTags } from './scanConfig'

interface ScanProjectOptions {
  srcRoot: string
  warn?: WarnFn
  state: ScanState
}

export async function scanProject({ srcRoot, warn, state }: ScanProjectOptions) {
  state.moduleMeta.clear()
  state.pageNavigationMap.clear()
  state.templateComponentMap.clear()
  state.templatePathSet.clear()
  state.componentTagMap.clear()
  state.componentIdMap.clear()

  let appNavigationDefaults = {}
  let appComponentTags: Record<string, string> = {}

  const pages = new Map<string, PageEntry>()
  const components = new Map<string, ComponentEntry>()

  const reportWarning = (message: string) => {
    if (warn) {
      warn(message)
      return
    }
    if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
      process.emitWarning(message)
    }
  }

  const appScript = await resolveScriptFile(join(srcRoot, 'app'))
  if (appScript) {
    state.moduleMeta.set(normalizePath(appScript), {
      kind: 'app',
      id: 'app',
      scriptPath: appScript,
      stylePath: await resolveStyleFile(appScript),
    })
  }

  const resolveComponentScript = async (raw: string, importerDir: string) => {
    const base = resolveComponentBase(raw, importerDir, srcRoot)
    if (!base) {
      return undefined
    }
    return resolveScriptFile(base)
  }

  const getComponentId = (script: string) => {
    const cached = state.componentIdMap.get(script)
    if (cached) {
      return cached
    }
    const idRelative = relative(srcRoot, script).replace(new RegExp(`${extname(script)}$`), '')
    const componentIdPosix = toPosixId(idRelative)
    state.componentIdMap.set(script, componentIdPosix)
    return componentIdPosix
  }

  const getComponentTag = (script: string) => {
    const cached = state.componentTagMap.get(script)
    if (cached) {
      return cached
    }
    const id = getComponentId(script)
    const tag = slugify(id, 'wv-component')
    state.componentTagMap.set(script, tag)
    return tag
  }

  const collectComponent = async (componentId: string, importerDir: string) => {
    const base = resolveComponentBase(componentId, importerDir, srcRoot)
    const script = base ? await resolveScriptFile(base) : undefined
    if (!script || components.has(script)) {
      return
    }

    const idRelative = relative(srcRoot, script).replace(new RegExp(`${extname(script)}$`), '')
    const componentIdPosix = toPosixId(idRelative)
    const template = await resolveTemplateFile(script)
    const style = await resolveStyleFile(script)

    if (template) {
      state.templatePathSet.add(normalizePath(template))
    }

    state.moduleMeta.set(normalizePath(script), {
      kind: 'component',
      id: componentIdPosix,
      scriptPath: script,
      templatePath: template,
      stylePath: style,
    })

    components.set(script, { script, id: componentIdPosix })

    const componentJsonBasePath = `${script.replace(new RegExp(`${extname(script)}$`), '')}.json`
    const componentTags = await collectComponentTagsFromJson({
      jsonBasePath: componentJsonBasePath,
      importerDir: dirname(script),
      warn: reportWarning,
      collectFromConfig: (json, nextImporterDir, jsonPath, nextWarn) => collectComponentTagsFromConfig({
        json,
        importerDir: nextImporterDir,
        jsonPath,
        warn: nextWarn,
        resolveComponentScript,
        getComponentTag,
        collectComponent,
      }),
    })

    if (!template) {
      return
    }

    const mergedTags = mergeComponentTags(appComponentTags, componentTags)
    if (Object.keys(mergedTags).length > 0) {
      state.templateComponentMap.set(normalizePath(template), mergedTags)
      return
    }
    state.templateComponentMap.delete(normalizePath(template))
  }

  const appJsonBasePath = join(srcRoot, 'app.json')
  const appJsonPath = await resolveJsonPath(appJsonBasePath)
  if (appJsonPath) {
    const appJson = await readJsonFile(appJsonPath)

    if (appJson) {
      appComponentTags = await collectComponentTagsFromConfig({
        json: appJson,
        importerDir: srcRoot,
        jsonPath: appJsonPath,
        warn: reportWarning,
        resolveComponentScript,
        getComponentTag,
        collectComponent,
        onResolved: (tags) => {
          appComponentTags = tags
        },
      })
    }

    if (appJson?.pages && Array.isArray(appJson.pages)) {
      for (const page of appJson.pages) {
        if (typeof page === 'string') {
          await collectPage(page)
        }
      }
    }

    if (appJson?.subPackages && Array.isArray(appJson.subPackages)) {
      for (const pkg of appJson.subPackages) {
        if (!pkg || typeof pkg !== 'object' || !Array.isArray(pkg.pages)) {
          continue
        }
        const root = typeof pkg.root === 'string' ? pkg.root : ''
        for (const page of pkg.pages) {
          if (typeof page !== 'string') {
            continue
          }
          await collectPage(posix.join(root, page))
        }
      }
    }

    const windowConfig = isRecord(appJson?.window) ? appJson.window : undefined
    appNavigationDefaults = pickNavigationConfig(windowConfig)
  }

  state.appNavigationDefaults = appNavigationDefaults
  state.appComponentTags = appComponentTags
  state.scanResult = {
    app: appScript,
    pages: Array.from(pages.values()),
    components: Array.from(components.values()),
  }

  async function collectPage(pageId: string) {
    const base = join(srcRoot, pageId)
    const script = await resolveScriptFile(base)
    if (!script) {
      return
    }

    const template = await resolveTemplateFile(base)
    if (template) {
      state.templatePathSet.add(normalizePath(template))
    }

    const style = await resolveStyleFile(base)
    const pageJsonBasePath = join(srcRoot, `${pageId}.json`)
    const pageJsonPath = await resolveJsonPath(pageJsonBasePath)
    const pageJson = pageJsonPath ? await readJsonFile(pageJsonPath) : undefined

    state.moduleMeta.set(normalizePath(script), {
      kind: 'page',
      id: toPosixId(pageId),
      scriptPath: script,
      templatePath: template,
      stylePath: style,
    })

    pages.set(script, {
      script,
      id: toPosixId(pageId),
    })

    const pageComponentTags = pageJson && pageJsonPath
      ? await collectComponentTagsFromConfig({
          json: pageJson,
          importerDir: dirname(script),
          jsonPath: pageJsonPath,
          warn: reportWarning,
          resolveComponentScript,
          getComponentTag,
          collectComponent,
        })
      : await collectComponentTagsFromJson({
          jsonBasePath: pageJsonBasePath,
          importerDir: dirname(script),
          warn: reportWarning,
          collectFromConfig: (json, importerDir, jsonPath, nextWarn) => collectComponentTagsFromConfig({
            json,
            importerDir,
            jsonPath,
            warn: nextWarn,
            resolveComponentScript,
            getComponentTag,
            collectComponent,
          }),
        })

    if (template) {
      const mergedTags = mergeComponentTags(appComponentTags, pageComponentTags)
      if (Object.keys(mergedTags).length > 0) {
        state.templateComponentMap.set(normalizePath(template), mergedTags)
      }
      else {
        state.templateComponentMap.delete(normalizePath(template))
      }
    }

    if (!template) {
      return
    }

    if (pageJson) {
      state.pageNavigationMap.set(
        normalizePath(template),
        mergeNavigationConfig(appNavigationDefaults, pickNavigationConfig(pageJson)),
      )
      return
    }

    state.pageNavigationMap.set(normalizePath(template), { ...appNavigationDefaults })
  }
}

function resolveComponentBase(raw: string, importerDir: string, srcRoot: string) {
  if (!raw) {
    return undefined
  }
  if (raw.startsWith('.')) {
    return resolve(importerDir, raw)
  }
  if (raw.startsWith('/')) {
    return resolve(srcRoot, raw.slice(1))
  }
  return resolve(srcRoot, raw)
}
