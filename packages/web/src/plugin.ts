/* eslint-disable ts/no-use-before-define */
import type { NodePath } from '@babel/traverse'
import type { CallExpression } from '@babel/types'
import type { Plugin } from 'vite'
import type { NavigationBarConfig } from './compiler/wxml'

import type { WxssTransformOptions } from './css/wxss'

import process from 'node:process'
import { parse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import * as t from '@babel/types'
import fs from 'fs-extra'
import MagicString from 'magic-string'

import { dirname, extname, join, normalize, posix, relative, resolve } from 'pathe'
import { compileWxml } from './compiler/wxml'
import { transformWxsToEsm } from './compiler/wxs'
import { transformWxssToCss } from './css/wxss'

type TraverseFunction = typeof _babelTraverse extends (...args: any[]) => any
  ? typeof _babelTraverse
  : typeof _babelTraverse extends { default: infer D }
    ? D
    : typeof _babelTraverse

const traverseCandidate: any = (() => {
  const mod: any = _babelTraverse
  if (typeof mod === 'function') {
    return mod
  }
  if (mod?.default && typeof mod.default === 'function') {
    return mod.default
  }
  if (mod?.traverse && typeof mod.traverse === 'function') {
    return mod.traverse
  }
  return undefined
})()

if (typeof traverseCandidate !== 'function') {
  throw new TypeError('[@weapp-vite/web] Failed to resolve @babel/traverse export.')
}

const traverse: TraverseFunction = traverseCandidate
export interface WeappWebPluginOptions {
  wxss?: WxssTransformOptions
  /**
   * Source root of the mini-program project. Defaults to `<root>/src`.
   */
  srcDir?: string
  /**
   * Form behavior config for web runtime.
   */
  form?: {
    /**
     * When true, prevent default browser form submission. Defaults to true.
     */
    preventDefault?: boolean
  }
}

const SCRIPT_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const STYLE_EXTS = ['.wxss', '.scss', '.less', '.css']
const TRANSFORM_STYLE_EXTS = ['.wxss']
const TEMPLATE_EXTS = ['.wxml', '.axml', '.swan', '.ttml', '.qml', '.ksml', '.xhsml', '.html']
const WXS_EXTS = ['.wxs', '.wxs.ts', '.wxs.js']
const ENTRY_ID = '\0@weapp-vite/web/entry'

function isTemplateFile(id: string) {
  const lower = id.toLowerCase()
  return TEMPLATE_EXTS.some(ext => lower.endsWith(ext))
}

function isWxsFile(id: string) {
  const lower = id.toLowerCase()
  return WXS_EXTS.some(ext => lower.endsWith(ext))
}

interface ModuleMeta {
  kind: 'app' | 'page' | 'component'
  id: string
  scriptPath: string
  templatePath?: string
  stylePath?: string
}

interface PageEntry {
  script: string
  id: string
}

interface ComponentEntry {
  script: string
  id: string
}

interface ScanResult {
  app?: string
  pages: PageEntry[]
  components: ComponentEntry[]
}

export function weappWebPlugin(options: WeappWebPluginOptions = {}): Plugin {
  let root = process.cwd()
  let srcRoot = resolve(root, options.srcDir ?? 'src')
  let enableHmr = false
  const moduleMeta = new Map<string, ModuleMeta>()
  const pageNavigationMap = new Map<string, NavigationBarConfig>()
  let appNavigationDefaults: NavigationBarConfig = {}
  let scanResult: ScanResult = {
    app: undefined,
    pages: [],
    components: [],
  }

  const wxssOptions = options.wxss
  const resolveTemplatePath = (raw: string, importer: string) => resolveTemplatePathSync(raw, importer, srcRoot)
  const resolveWxsPath = (raw: string, importer: string) => resolveWxsPathSync(raw, importer, srcRoot)

  return {
    name: '@weapp-vite/web',
    enforce: 'pre',
    async configResolved(config) {
      root = config.root
      srcRoot = resolve(root, options.srcDir ?? 'src')
      enableHmr = config.command === 'serve'
      await scanProject()
    },
    async buildStart() {
      await scanProject()
    },
    resolveId(id) {
      if (id === '/@weapp-vite/web/entry' || id === '@weapp-vite/web/entry') {
        return ENTRY_ID
      }
      return null
    },
    load(id) {
      if (id === ENTRY_ID) {
        return generateEntryModule(scanResult, root, wxssOptions, options)
      }
      return null
    },
    async handleHotUpdate(ctx) {
      const clean = cleanUrl(ctx.file)
      if (clean.endsWith('.json') || isTemplateFile(clean) || isWxsFile(clean) || clean.endsWith('.wxss') || SCRIPT_EXTS.includes(extname(clean))) {
        await scanProject()
      }
    },
    transform(code, id) {
      const clean = cleanUrl(id)

      if (isTemplateFile(clean)) {
        const navigationConfig = pageNavigationMap.get(normalizePath(clean))
        const { code: compiled, dependencies, warnings } = compileWxml({
          id: clean,
          source: code,
          resolveTemplatePath,
          resolveWxsPath,
          navigationBar: navigationConfig ? { config: navigationConfig } : undefined,
        })
        if (dependencies.length > 0 && 'addWatchFile' in this) {
          for (const dep of dependencies) {
            this.addWatchFile(dep)
          }
        }
        if (warnings?.length && 'warn' in this) {
          for (const warning of warnings) {
            this.warn(warning)
          }
        }
        return { code: compiled, map: null }
      }

      if (isWxsFile(clean)) {
        const { code: compiled, dependencies } = transformWxsToEsm(code, clean, {
          resolvePath: resolveWxsPath,
          toImportPath: (resolved, importer) => normalizePath(toRelativeImport(importer, resolved)),
        })
        if (dependencies.length > 0 && 'addWatchFile' in this) {
          for (const dep of dependencies) {
            this.addWatchFile(dep)
          }
        }
        return { code: compiled, map: null }
      }

      if (TRANSFORM_STYLE_EXTS.some(ext => clean.endsWith(ext))) {
        const { css } = transformWxssToCss(code, wxssOptions)
        const serialized = JSON.stringify(css)
        return {
          code: [
            `const __weapp_injected_styles__ = new Map()`,
            `function __weapp_createStyleId__(css) {`,
            `  let hash = 2166136261`,
            `  for (let i = 0; i < css.length; i++) {`,
            `    hash ^= css.charCodeAt(i)`,
            `    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)`,
            `  }`,
            `  return 'weapp-web-style-' + (hash >>> 0).toString(36)`,
            `}`,
            `function __weapp_removeStyle__(id) {`,
            `  if (typeof document === 'undefined') {`,
            `    return`,
            `  }`,
            `  const style = __weapp_injected_styles__.get(id)`,
            `  if (style) {`,
            `    style.remove()`,
            `    __weapp_injected_styles__.delete(id)`,
            `  }`,
            `}`,
            `function injectStyle(css, id) {`,
            `  if (typeof document === 'undefined') {`,
            `    return () => {}`,
            `  }`,
            `  const styleId = id ?? __weapp_createStyleId__(css)`,
            `  const existing = __weapp_injected_styles__.get(styleId)`,
            `  if (existing) {`,
            `    if (existing.textContent !== css) {`,
            `      existing.textContent = css`,
            `    }`,
            `    return () => __weapp_removeStyle__(styleId)`,
            `  }`,
            `  const style = document.createElement('style')`,
            `  style.id = styleId`,
            `  style.textContent = css`,
            `  document.head.append(style)`,
            `  __weapp_injected_styles__.set(styleId, style)`,
            `  return () => __weapp_removeStyle__(styleId)`,
            `}`,
            `const css = ${serialized}`,
            `export default css`,
            `export function useStyle(id) {`,
            `  return injectStyle(css, id)`,
            `}`,
          ].join('\n'),
          map: null,
        }
      }

      if (STYLE_EXTS.some(ext => clean.endsWith(ext)) && !clean.endsWith('.wxss')) {
        const { css } = transformWxssToCss(code, wxssOptions)
        return { code: css, map: null }
      }

      if (!SCRIPT_EXTS.some(ext => clean.endsWith(ext))) {
        return null
      }
      if (clean.includes('node_modules')) {
        return null
      }

      const meta = moduleMeta.get(normalizePath(clean))
      if (!meta) {
        return null
      }

      const registerName = getRegisterName(meta.kind)
      if (!registerName) {
        return null
      }

      let ast: ReturnType<typeof parse> | undefined
      try {
        ast = parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true,
          ranges: true,
        })
      }
      catch {
        return null
      }

      const s = new MagicString(code)
      let transformed = false

      const imports: string[] = []

      const templateIdent = meta.templatePath ? `__weapp_template__` : undefined
      const styleIdent = meta.stylePath ? `__weapp_style__` : undefined

      if (meta.templatePath && templateIdent) {
        imports.push(`import ${templateIdent} from '${toRelativeImport(clean, meta.templatePath)}'`)
      }

      if (meta.stylePath && styleIdent) {
        imports.push(`import ${styleIdent} from '${appendInlineQuery(toRelativeImport(clean, meta.stylePath))}'`)
      }

      const registerImports = new Set<string>()

      traverse(ast, {
        CallExpression(path: NodePath<CallExpression>) {
          if (!t.isIdentifier(path.node.callee)) {
            return
          }
          const name = path.node.callee.name
          if (name === mapRegisterIdentifier(meta.kind)) {
            registerImports.add(registerName)
            overwriteCall(path, meta, registerName, templateIdent, styleIdent, s)
            transformed = true
          }
        },
      })

      if (!transformed) {
        return null
      }

      if (registerImports.size > 0) {
        imports.unshift(`import { ${Array.from(registerImports).join(', ')} } from '@weapp-vite/web/runtime/polyfill'`)
      }

      const prefix = `${imports.join('\n')}\n`
      s.prepend(prefix)

      if (enableHmr) {
        s.append(`\nif (import.meta.hot) { import.meta.hot.accept() }\n`)
      }

      return {
        code: s.toString(),
        map: s.generateMap({
          hires: true,
        }),
      }
    },
  }

  async function scanProject() {
    moduleMeta.clear()
    pageNavigationMap.clear()
    appNavigationDefaults = {}
    const pages = new Map<string, PageEntry>()
    const components = new Map<string, ComponentEntry>()

    const appScript = await resolveScriptFile(join(srcRoot, 'app'))
    if (appScript) {
      moduleMeta.set(
        normalizePath(appScript),
        {
          kind: 'app',
          id: 'app',
          scriptPath: appScript,
          stylePath: await resolveStyleFile(appScript),
        },
      )
    }

    const appJsonPath = join(srcRoot, 'app.json')
    if (await fs.pathExists(appJsonPath)) {
      const appJson = await readJsonFile(appJsonPath)
      if (appJson?.pages && Array.isArray(appJson.pages)) {
        for (const page of appJson.pages) {
          if (typeof page === 'string') {
            await collectPage(page)
          }
        }
      }
      if (appJson?.subPackages && Array.isArray(appJson.subPackages)) {
        for (const pkg of appJson.subPackages) {
          if (!pkg || typeof pkg !== 'object') {
            continue
          }
          const root = typeof pkg.root === 'string' ? pkg.root : ''
          if (!Array.isArray(pkg.pages)) {
            continue
          }
          for (const page of pkg.pages) {
            if (typeof page !== 'string') {
              continue
            }
            const full = posix.join(root, page)
            await collectPage(full)
          }
        }
      }
      const windowConfig = isRecord(appJson?.window) ? appJson.window : undefined
      appNavigationDefaults = pickNavigationConfig(windowConfig)
    }

    scanResult = {
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
      const style = await resolveStyleFile(base)
      const pageJsonPath = join(srcRoot, `${pageId}.json`)
      const pageJson = await readJsonFile(pageJsonPath)
      moduleMeta.set(
        normalizePath(script),
        {
          kind: 'page',
          id: toPosixId(pageId),
          scriptPath: script,
          templatePath: template,
          stylePath: style,
        },
      )
      pages.set(script, {
        script,
        id: toPosixId(pageId),
      })
      if (pageJson) {
        await collectComponentsFromConfig(pageJson, dirname(script))
        if (template) {
          const config = mergeNavigationConfig(appNavigationDefaults, pickNavigationConfig(pageJson))
          pageNavigationMap.set(normalizePath(template), config)
        }
      }
      else {
        await collectComponentsFromJson(pageJsonPath, dirname(script))
        if (template) {
          pageNavigationMap.set(normalizePath(template), { ...appNavigationDefaults })
        }
      }
    }

    async function collectComponent(componentId: string, importerDir: string) {
      const base = resolveComponentBase(componentId, importerDir)
      const script = base ? await resolveScriptFile(base) : undefined
      if (!script) {
        return
      }
      if (components.has(script)) {
        return
      }
      const idRelative = relative(srcRoot, script).replace(new RegExp(`${extname(script)}$`), '')
      const componentIdPosix = toPosixId(idRelative)
      const template = await resolveTemplateFile(script)
      const style = await resolveStyleFile(script)
      moduleMeta.set(
        normalizePath(script),
        {
          kind: 'component',
          id: componentIdPosix,
          scriptPath: script,
          templatePath: template,
          stylePath: style,
        },
      )
      components.set(script, {
        script,
        id: componentIdPosix,
      })
      await collectComponentsFromJson(`${script.replace(new RegExp(`${extname(script)}$`), '')}.json`, dirname(script))
    }

    async function collectComponentsFromConfig(json: Record<string, unknown>, importerDir: string) {
      const usingComponents = json.usingComponents
      if (!usingComponents || typeof usingComponents !== 'object') {
        return
      }
      for (const value of Object.values(usingComponents)) {
        if (typeof value !== 'string') {
          continue
        }
        await collectComponent(value, importerDir)
      }
    }

    async function collectComponentsFromJson(jsonPath: string, importerDir: string) {
      const json = await readJsonFile(jsonPath)
      if (!json) {
        return
      }
      await collectComponentsFromConfig(json, importerDir)
    }

    function resolveComponentBase(raw: string, importerDir: string) {
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
  }
}

function cleanUrl(url: string) {
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) {
    return url.slice(0, queryIndex)
  }
  return url
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJsonFile(pathname: string) {
  if (!(await fs.pathExists(pathname))) {
    return undefined
  }
  const json = await fs.readJson(pathname).catch(() => undefined)
  if (!isRecord(json)) {
    return undefined
  }
  return json
}

function pickNavigationConfig(source: Record<string, unknown> | undefined): NavigationBarConfig {
  const config: NavigationBarConfig = {}
  if (!source) {
    return config
  }
  if (typeof source.navigationBarTitleText === 'string') {
    config.title = source.navigationBarTitleText
  }
  if (typeof source.navigationBarBackgroundColor === 'string') {
    config.backgroundColor = source.navigationBarBackgroundColor
  }
  if (typeof source.navigationBarTextStyle === 'string') {
    config.textStyle = source.navigationBarTextStyle
  }
  if (typeof source.navigationStyle === 'string') {
    config.navigationStyle = source.navigationStyle
  }
  return config
}

function mergeNavigationConfig(base: NavigationBarConfig, overrides: NavigationBarConfig) {
  return {
    ...base,
    ...overrides,
  }
}

function normalizePath(p: string) {
  return posix.normalize(p.split('\\').join('/'))
}

function resolveImportBase(raw: string, importer: string, srcRoot: string) {
  if (!raw) {
    return undefined
  }
  if (raw.startsWith('.')) {
    return resolve(dirname(importer), raw)
  }
  if (raw.startsWith('/')) {
    return resolve(srcRoot, raw.slice(1))
  }
  return resolve(srcRoot, raw)
}

function resolveFileWithExtensionsSync(basePath: string, extensions: string[]) {
  if (extname(basePath) && fs.pathExistsSync(basePath)) {
    return basePath
  }
  for (const ext of extensions) {
    const candidate = `${basePath}${ext}`
    if (fs.pathExistsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

function resolveTemplatePathSync(raw: string, importer: string, srcRoot: string) {
  const base = resolveImportBase(raw, importer, srcRoot)
  if (!base) {
    return undefined
  }
  return resolveFileWithExtensionsSync(base, TEMPLATE_EXTS)
}

function resolveWxsPathSync(raw: string, importer: string, srcRoot: string) {
  const base = resolveImportBase(raw, importer, srcRoot)
  if (!base) {
    return undefined
  }
  return resolveFileWithExtensionsSync(base, WXS_EXTS)
}

async function resolveScriptFile(basePath: string) {
  const ext = extname(basePath)
  if (ext && (await fs.pathExists(basePath))) {
    return basePath
  }
  for (const candidateExt of SCRIPT_EXTS) {
    const candidate = `${basePath}${candidateExt}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

async function resolveStyleFile(scriptPath: string) {
  const base = scriptPath.replace(new RegExp(`${extname(scriptPath)}$`), '')
  for (const ext of STYLE_EXTS) {
    const candidate = `${base}${ext}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

async function resolveTemplateFile(scriptPath: string) {
  const base = scriptPath.replace(new RegExp(`${extname(scriptPath)}$`), '')
  for (const ext of TEMPLATE_EXTS) {
    const candidate = `${base}${ext}`
    if (await fs.pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

function toPosixId(id: string) {
  return normalize(id).split('\\').join('/')
}

function toRelativeImport(from: string, target: string) {
  const fromDir = dirname(from)
  const rel = relative(fromDir, target)
  if (!rel || rel.startsWith('.')) {
    return normalizePath(rel || `./${posix.basename(target)}`)
  }
  return `./${normalizePath(rel)}`
}

function appendInlineQuery(id: string) {
  if (id.includes('?')) {
    if (id.includes('?inline') || id.includes('&inline')) {
      return id
    }
    return `${id}&inline`
  }
  return `${id}?inline`
}

function mapRegisterIdentifier(kind: ModuleMeta['kind']) {
  if (kind === 'page') {
    return 'Page'
  }
  if (kind === 'component') {
    return 'Component'
  }
  if (kind === 'app') {
    return 'App'
  }
  return ''
}

function getRegisterName(kind: ModuleMeta['kind']) {
  if (kind === 'page') {
    return 'registerPage'
  }
  if (kind === 'component') {
    return 'registerComponent'
  }
  if (kind === 'app') {
    return 'registerApp'
  }
  return undefined
}

function overwriteCall(
  path: NodePath<CallExpression>,
  meta: ModuleMeta,
  registerName: string,
  templateIdent: string | undefined,
  styleIdent: string | undefined,
  s: MagicString,
) {
  const node = path.node
  const callee = node.callee
  if (!t.isIdentifier(callee)) {
    return
  }
  const end = node.end!
  const insertPosition = end - 1
  const metaParts: string[] = [`id: ${JSON.stringify(meta.id)}`]
  if (templateIdent) {
    metaParts.push(`template: ${templateIdent}`)
  }
  if (styleIdent) {
    metaParts.push(`style: ${styleIdent}`)
  }
  const metaCode = `{ ${metaParts.join(', ')} }`
  s.overwrite(callee.start!, callee.end!, registerName)
  s.appendLeft(insertPosition, `, ${metaCode}`)
}

function generateEntryModule(
  result: ScanResult,
  root: string,
  wxssOptions?: WxssTransformOptions,
  pluginOptions?: WeappWebPluginOptions,
) {
  const importLines: string[] = [`import { initializePageRoutes } from '@weapp-vite/web/runtime/polyfill'`]
  const bodyLines: string[] = []
  for (const page of result.pages) {
    importLines.push(`import '${relativeModuleId(root, page.script)}'`)
  }
  for (const component of result.components) {
    importLines.push(`import '${relativeModuleId(root, component.script)}'`)
  }
  if (result.app) {
    importLines.push(`import '${relativeModuleId(root, result.app)}'`)
  }
  const pageOrder = result.pages.map(page => page.id)
  const rpxConfig = wxssOptions?.designWidth
    ? { designWidth: wxssOptions.designWidth, varName: wxssOptions.rpxVar }
    : undefined
  const initOptions: Record<string, any> = {}
  if (rpxConfig) {
    initOptions.rpx = rpxConfig
  }
  if (pluginOptions?.form?.preventDefault !== undefined) {
    initOptions.form = { preventDefault: pluginOptions.form.preventDefault }
  }
  const initOptionsCode = Object.keys(initOptions).length > 0 ? `, ${JSON.stringify(initOptions)}` : ''
  bodyLines.push(`initializePageRoutes(${JSON.stringify(pageOrder)}${initOptionsCode})`)
  return [...importLines, ...bodyLines].join('\n')
}

function relativeModuleId(root: string, absPath: string) {
  const rel = relative(root, absPath)
  return `/${normalizePath(rel)}`
}
