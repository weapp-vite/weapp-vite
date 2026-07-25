import type { WebTabBarConfig } from '../shared/tabBar'
import type { ComponentEntry, LayoutEntry, ModuleMeta, PageEntry, ResolveWebModuleId, ScanState, WarnFn } from './types'

import { readdir } from 'node:fs/promises'
import process from 'node:process'
import { dirname, extname, join, posix, relative, resolve } from 'pathe'
import { slugify } from '../shared/slugify'
import { normalizeWebTabBarConfig } from '../shared/tabBar'
import { SCRIPT_EXTS } from './constants'
import { isRecord, readJsonFile, resolveJsonPath, resolveScriptFile, resolveStyleFile, resolveTemplateFile } from './files'
import { mergeNavigationConfig, pickNavigationConfig } from './navigation'
import { normalizePath, toPosixId } from './path'
import { collectComponentTagsFromConfig, collectComponentTagsFromJson, mergeComponentTags } from './scanConfig'
import { compileScannedSfc, discoverWebPageIds } from './scanSfc'

interface ScanProjectOptions {
  srcRoot: string
  warn?: WarnFn
  state: ScanState
  resolveId?: ResolveWebModuleId
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

export async function scanProject({ srcRoot, warn, state, resolveId }: ScanProjectOptions) {
  state.moduleMeta.clear()
  state.pageNavigationMap.clear()
  state.templateComponentMap.clear()
  state.templatePathSet.clear()
  state.componentTagMap.clear()
  state.componentIdMap.clear()
  state.sfcResults.clear()

  let appNavigationDefaults = {}
  let appComponentTags: Record<string, string> = {}
  let appTabBar: WebTabBarConfig | undefined

  const pages = new Map<string, PageEntry>()
  const components = new Map<string, ComponentEntry>()
  const layouts = new Map<string, LayoutEntry>()

  async function walk(current: string, files: string[]) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const pathname = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(pathname, files)
      }
      else {
        files.push(pathname)
      }
    }
  }

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
    const appMeta: ModuleMeta = {
      kind: 'app',
      id: 'app',
      scriptPath: appScript,
      stylePath: await resolveStyleFile(appScript),
      sourceType: appScript.endsWith('.vue') ? 'vue-sfc' : 'native',
    }
    state.moduleMeta.set(normalizePath(appScript), appMeta)
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

    const componentMeta: ModuleMeta = {
      kind: 'component',
      id: componentIdPosix,
      scriptPath: script,
      templatePath: template,
      stylePath: style,
      sourceType: script.endsWith('.vue') ? 'vue-sfc' : 'native',
    }
    state.moduleMeta.set(normalizePath(script), componentMeta)

    components.set(script, { script, id: componentIdPosix })

    const componentJsonBasePath = `${script.replace(new RegExp(`${extname(script)}$`), '')}.json`
    const sfcConfig = script.endsWith('.vue')
      ? (await compileScannedSfc({ filename: script, meta: componentMeta, srcRoot, state, resolveId })).config
      : undefined
    const componentTags = sfcConfig
      ? await collectComponentTagsFromConfig({
          json: sfcConfig,
          importerDir: dirname(script),
          jsonPath: script,
          warn: reportWarning,
          resolveComponentScript,
          getComponentTag,
          collectComponent,
        })
      : await collectComponentTagsFromJson({
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
    componentMeta.componentTags = mergeComponentTags(appComponentTags, componentTags)

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
    const pageMeta: ModuleMeta = {
      kind: 'page',
      id: toPosixId(pageId),
      scriptPath: script,
      templatePath: template,
      stylePath: style,
      sourceType: script.endsWith('.vue') ? 'vue-sfc' : 'native',
    }

    const sfcConfig = script.endsWith('.vue')
      ? (await compileScannedSfc({ filename: script, meta: pageMeta, srcRoot, state, resolveId })).config
      : undefined
    const resolvedNavigationConfig = mergeNavigationConfig(
      appNavigationDefaults,
      sfcConfig ? pickNavigationConfig(sfcConfig) : pageJson ? pickNavigationConfig(pageJson) : {},
    )
    pageMeta.navigationBar = Object.keys(resolvedNavigationConfig).length > 0
      ? resolvedNavigationConfig
      : undefined
    state.moduleMeta.set(normalizePath(script), pageMeta)

    pages.set(script, {
      script,
      id: toPosixId(pageId),
    })

    const pageComponentTags = sfcConfig
      ? await collectComponentTagsFromConfig({
          json: sfcConfig,
          importerDir: dirname(script),
          jsonPath: script,
          warn: reportWarning,
          resolveComponentScript,
          getComponentTag,
          collectComponent,
        })
      : pageJson && pageJsonPath
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
    pageMeta.componentTags = mergeComponentTags(appComponentTags, pageComponentTags)

    if (!template) {
      return
    }

    state.pageNavigationMap.set(normalizePath(template), resolvedNavigationConfig)
  }

  async function collectLayouts() {
    const layoutsRoot = join(srcRoot, 'layouts')
    const files: string[] = []
    try {
      await walk(layoutsRoot, files)
    }
    catch {
      return
    }
    for (const filename of files.sort()) {
      const script = SCRIPT_EXTS.includes(extname(filename)) ? filename : undefined
      if (!script) {
        continue
      }
      const relativePath = relative(layoutsRoot, script).replace(/\\/g, '/')
      const segments = relativePath.split('/')
      segments.pop()
      if (segments[segments.length - 1] === 'index') {
        segments.pop()
      }
      const name = segments.join('/')
      if (!name) {
        continue
      }
      const id = `layouts/${name}`
      const template = await resolveTemplateFile(script)
      const style = await resolveStyleFile(script)
      const tag = slugify(id, 'wv-component')
      state.moduleMeta.set(normalizePath(script), {
        kind: 'component',
        id,
        scriptPath: script,
        templatePath: template,
        stylePath: style,
        sourceType: 'native',
      })
      layouts.set(script, { script, id, name, tag, template, style })
      if (template) {
        state.templatePathSet.add(normalizePath(template))
      }
    }
  }

  const appJsonBasePath = join(srcRoot, 'app.json')
  const appJsonPath = await resolveJsonPath(appJsonBasePath)
  let appJson = appJsonPath ? await readJsonFile(appJsonPath) : undefined
  if (appScript?.endsWith('.vue')) {
    const appMeta = state.moduleMeta.get(normalizePath(appScript))!
    const sfcConfig = (await compileScannedSfc({ filename: appScript, meta: appMeta, srcRoot, state, resolveId })).config
    appJson = {
      ...(sfcConfig ?? {}),
      ...(appJson ?? {}),
    }
  }
  if (appJson) {
    appComponentTags = await collectComponentTagsFromConfig({
      json: appJson,
      importerDir: srcRoot,
      jsonPath: appJsonPath ?? appScript ?? appJsonBasePath,
      warn: reportWarning,
      resolveComponentScript,
      getComponentTag,
      collectComponent,
      onResolved: (tags) => {
        appComponentTags = tags
      },
    })

    const windowConfig = isRecord(appJson?.window) ? appJson.window : undefined
    appNavigationDefaults = pickNavigationConfig(windowConfig)

    const configuredPages = Array.isArray(appJson.pages)
      ? appJson.pages.filter((page): page is string => typeof page === 'string')
      : []
    for (const page of configuredPages.length > 0 ? configuredPages : await discoverWebPageIds(srcRoot)) {
      await collectPage(page)
    }

    const subPackages = Array.isArray(appJson.subPackages)
      ? appJson.subPackages
      : Array.isArray(appJson.subpackages)
        ? appJson.subpackages
        : []
    if (subPackages.length > 0) {
      for (const pkg of subPackages) {
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

    appTabBar = normalizeWebTabBarConfig(appJson?.tabBar)
  }
  else {
    for (const page of await discoverWebPageIds(srcRoot)) {
      await collectPage(page)
    }
  }

  await collectLayouts()

  state.appNavigationDefaults = appNavigationDefaults
  state.appComponentTags = appComponentTags
  state.scanResult = {
    app: appScript,
    pages: Array.from(pages.values()),
    components: Array.from(components.values()),
    layouts: Array.from(layouts.values()),
    tabBar: appTabBar,
  }
}
