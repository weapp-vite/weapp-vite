import type { Declaration, Rule } from 'postcss'
import { access, readFile, rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import postcss from 'postcss'
import prettier from 'prettier'
import { expect } from 'vitest'
import { extractConfigFromVue } from '../packages/weapp-vite/src/utils/file'
import { launchAutomator } from './utils/automator'
import { runWeappViteBuildWithLogCapture } from './utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_JSON_PATH = 'src/app.json'
const APP_VUE_PATH = 'src/app.vue'
const DIST_APP_JSON_PATH = 'dist/app.json'
const TEMPLATE_E2E_DEBUG = process.env.WEAPP_VITE_TEMPLATE_E2E_DEBUG === '1'
const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const TAP_ATTR_RE = /\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g
const PHONE_NUMBER_NO_QUOTA_TOAST_ATTR_RE = /\s+phone-number-no-quota-toast=""/g
const INVALID_INPUT_RE = /<input\b([^>]*)>([\s\S]*?)<\/input>/gi
const LEADING_SLASH_RE = /^\/+/
const TRAILING_SLASH_RE = /\/+$/
const CSS_DECLARATION_START_RE = /^(\s*)([a-z-]+):(?:\s.*)?$/
const LEGACY_PSEUDO_ELEMENT_RE = /(^|[^:]):(before|after)\b/g
const ZERO_UNIT_RE = /(^|[^\w.-])0(?:px|rpx|rem|em|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|q|%)\b/g
const SECOND_TIME_RE = /(^|[\s,(])(\d+\.\d+|\d+|\.\d+)s(?=($|[\s),]))/g
const MS_TIME_RE = /(^|[\s,(])(\d+\.\d+|\d+|\.\d+)ms(?=($|[\s),]))/g
const RGBA_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([+-]?(\d+\.\d+|\d+|\.\d+)))?\s*\)/gi
const VITE_MARKER_COMMENT_RE = /^\$vite\$:\d+$/

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf-8')) as T
}

function debugTemplateE2E(templateName: string, phase: string, detail?: string) {
  if (!TEMPLATE_E2E_DEBUG) {
    return
  }
  const suffix = detail ? ` ${detail}` : ''
  process.stdout.write(`[template-e2e:${templateName}] ${phase}${suffix}\n`)
}

export interface TemplateE2EOptions {
  templateRoot: string
  templateName: string
}

export async function formatWxml(wxml: string) {
  return await prettier.format(wxml, {
    parser: 'html',
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    endOfLine: 'lf',
    trailingComma: 'none',
    printWidth: 100,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: 'ignore',
  })
}

function normalizeButtonCompatAttrs(wxml: string) {
  return wxml.replace(/<button\b([^>]*)>/g, (_fullMatch, attrsRaw: string) => {
    const attrs = attrsRaw ?? ''
    const normalizedAttrs = attrs.trim()
    const attrMap = new Map<string, string>()
    const attrOrder: string[] = []

    for (const match of normalizedAttrs.matchAll(/([:@\w-]+)\s*=\s*(".*?"|'.*?')/g)) {
      const name = match[1]
      const value = match[2]
      if (!name || !value) {
        continue
      }
      if (!attrMap.has(name)) {
        attrOrder.push(name)
      }
      attrMap.set(name, value)
    }

    const ensureAttr = (name: string, value: string) => {
      if (attrMap.has(name)) {
        return
      }
      attrMap.set(name, value)
    }

    ensureAttr('activity-type', '"0"')
    ensureAttr('entrance-path', '""')
    ensureAttr('need-show-entrance', '""')

    const fixedPrefix = ['activity-type', 'entrance-path', 'need-show-entrance', 'app-parameter']
    const renderedNames = new Set<string>()
    const renderedAttrs: string[] = []

    for (const name of fixedPrefix) {
      const value = attrMap.get(name)
      if (!value) {
        continue
      }
      renderedNames.add(name)
      renderedAttrs.push(`${name}=${value}`)
    }

    for (const name of attrOrder) {
      if (renderedNames.has(name)) {
        continue
      }
      const value = attrMap.get(name)
      if (!value) {
        continue
      }
      renderedNames.add(name)
      renderedAttrs.push(`${name}=${value}`)
    }

    for (const [name, value] of attrMap.entries()) {
      if (renderedNames.has(name)) {
        continue
      }
      renderedNames.add(name)
      renderedAttrs.push(`${name}=${value}`)
    }

    const merged = renderedAttrs.join(' ')
    return `<button ${merged}>`
  })
}

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

export function normalizeWxmlForSnapshot(wxml: string) {
  const cleaned = normalizeButtonCompatAttrs(stripAutomatorOverlay(wxml))
    .replace(TAP_ATTR_RE, '')
    .replace(PHONE_NUMBER_NO_QUOTA_TOAST_ATTR_RE, '')
    // Normalize invalid void-element markup from devtools.
    .replace(INVALID_INPUT_RE, '<input$1 />$2')

  const normalizedTabs = cleaned
    // Normalize dynamic hashes in tdesign ids/aria attributes.
    .replace(/id="([0-9a-f]{8})--t-action-sheet"/g, 'id="t-action-sheet--stable"')
    .replace(/aria-describedby="([0-9a-f]{8})--true"/g, 'aria-describedby="t-input-desc--stable"')
    .replace(/aria-describedby="([0-9a-f]{8})--t_badge_(\d+)_description"/g, (_match, _id, index) => (
      `aria-describedby="t_badge_${index}_description"`
    ))
    .replace(/aria-labelledby="([0-9a-f]{8})--t_badge_(\d+)_label"/g, (_match, _id, index) => (
      `aria-labelledby="t_badge_${index}_label"`
    ))
    .replace(/id="([0-9a-f]{8})--t_badge_(\d+)_label"/g, (_match, _id, index) => (
      `id="t_badge_${index}_label"`
    ))
    .replace(/id="([0-9a-f]{8})--t_badge_(\d+)_description"/g, (_match, _id, index) => (
      `id="t_badge_${index}_description"`
    ))
    .replace(/aria-controls="([0-9a-f]{8})--t_tabs_(?!0)(\d+)_panel_(\d+)"/g, (_match, _id, group, index) => (
      `aria-controls="t_tabs_${group}_panel_${index}"`
    ))
    .replace(/id="([0-9a-f]{8})--t_tabs_(?!0)(\d+)_panel_(\d+)"/g, (_match, _id, group, index) => (
      `id="t_tabs_${group}_panel_${index}"`
    ))
    // Normalize tdesign tabs aria-controls ids.
    .replace(/aria-controls="([0-9a-f]{8})--t_tabs_0_panel_(\d+)"/g, (_match, _id, index) => (
      `aria-controls="c9814c17--t_tabs_0_panel_${index}"`
    ))
    // Normalize tdesign tabs panel ids.
    .replace(/id="([0-9a-f]{8})--t_tabs_0_panel_(\d+)"/g, (_match, _id, index) => {
      const mapped = {
        0: '723fc055',
        1: '1b31d0d4',
        2: '063b76de',
      }[index]
      return mapped ? `id="${mapped}--t_tabs_0_panel_${index}"` : `id="c9814c17--t_tabs_0_panel_${index}"`
    })
    // Normalize scoped id hash prefixes generated for user-defined ids in components.
    .replace(/id="([0-9a-f]{8})--(?!t_)([^"]+)"/g, (_match, _id, suffix) => (
      `id="${suffix}"`
    ))
    // Normalize tabs track translateX variations.
    .replace(/translateX\([\d.]+px\)/g, 'translateX(187px)')

  return normalizedTabs
}

function normalizeCssSelector(selector: string) {
  return selector
    .split(',')
    .map(segment => segment.trim().replace(LEGACY_PSEUDO_ELEMENT_RE, '$1::$2'))
    .join(',\n')
}

function clampCssChannel(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(255, Math.max(0, Math.round(value)))
}

function clampCssAlpha(value: number) {
  if (!Number.isFinite(value)) {
    return Number.NaN
  }
  return Math.min(1, Math.max(0, value))
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0')
}

function stripTrailingZeros(value: number) {
  const normalized = `${value}`
  if (!normalized.includes('.')) {
    return normalized
  }
  return normalized.replace(/0+$/, '').replace(/\.$/, '')
}

function normalizeCssColorFunctions(value: string) {
  return value.replace(RGBA_RE, (match, rawR: string, rawG: string, rawB: string, rawAlpha?: string) => {
    const red = clampCssChannel(Number(rawR))
    const green = clampCssChannel(Number(rawG))
    const blue = clampCssChannel(Number(rawB))

    if (rawAlpha == null) {
      return match
    }

    const alpha = clampCssAlpha(Number(rawAlpha))
    if (!Number.isFinite(alpha)) {
      return match
    }
    if (alpha === 0) {
      return 'transparent'
    }

    const alphaByte = Math.round(alpha * 255)
    if (alphaByte === 255) {
      return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
    }

    return `#${toHex(red)}${toHex(green)}${toHex(blue)}${toHex(alphaByte)}`
  })
}

function normalizeCssValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return normalizeCssColorFunctions(
    trimmed
      .replace(SECOND_TIME_RE, (_match, prefix: string, rawValue: string) => {
        const parsed = Number(rawValue)
        if (!Number.isFinite(parsed)) {
          return `${prefix}${rawValue}s`
        }
        return `${prefix}${stripTrailingZeros(parsed * 1000)}ms`
      })
      .replace(MS_TIME_RE, (_match, prefix: string, rawValue: string) => {
        const parsed = Number(rawValue)
        if (!Number.isFinite(parsed)) {
          return `${prefix}${rawValue}ms`
        }
        return `${prefix}${stripTrailingZeros(parsed)}ms`
      })
      .replace(ZERO_UNIT_RE, '$10')
      .replace(/\btransparent\b/gi, 'transparent'),
  )
}

function sortRuleDeclarations(rule: Rule) {
  const nodes = rule.nodes ?? []
  if (nodes.length < 2 || nodes.some(node => node.type !== 'decl')) {
    return
  }

  const declarations = nodes as Declaration[]
  const propSet = new Set<string>()
  for (const declaration of declarations) {
    if (propSet.has(declaration.prop)) {
      return
    }
    propSet.add(declaration.prop)
  }

  const sorted = [...declarations].sort((left, right) => {
    const propCompare = left.prop.localeCompare(right.prop)
    if (propCompare !== 0) {
      return propCompare
    }
    return left.value.localeCompare(right.value)
  })

  rule.removeAll()
  for (const declaration of sorted) {
    rule.append(declaration)
  }
}

function normalizeWxssForSnapshot(wxss: string) {
  const lines = wxss.split('\n')
  const normalized: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const declarationMatch = CSS_DECLARATION_START_RE.exec(line)
    if (!declarationMatch || line.trimStart().startsWith('@')) {
      normalized.push(line)
      continue
    }

    const block = [line]
    while (index + 1 < lines.length && !block.at(-1)?.trimEnd().endsWith(';')) {
      index += 1
      block.push(lines[index]!)
    }

    const property = declarationMatch[2]
    const previousStart = normalized.at(-1)
    const previousMatch = previousStart
      ? CSS_DECLARATION_START_RE.exec(previousStart)
      : null

    if (previousMatch?.[1] === declarationMatch[1] && previousMatch[2] === property) {
      while (normalized.length > 0) {
        const current = normalized.pop()
        if (current?.trimEnd().endsWith(';')) {
          break
        }
      }
    }

    normalized.push(...block)
  }

  const ast = postcss.parse(normalized.join('\n'))

  ast.walkComments((comment) => {
    if (VITE_MARKER_COMMENT_RE.test(comment.text.trim())) {
      comment.remove()
    }
  })

  ast.walkRules((rule) => {
    rule.selector = normalizeCssSelector(rule.selector)

    for (const node of rule.nodes ?? []) {
      if (node.type !== 'decl') {
        continue
      }
      node.value = normalizeCssValue(node.value)
    }

    sortRuleDeclarations(rule)
  })

  return ast.toString()
}

export async function formatWxss(wxss: string) {
  return await prettier.format(normalizeWxssForSnapshot(wxss), {
    parser: 'css',
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    endOfLine: 'lf',
    trailingComma: 'none',
    printWidth: 120,
  })
}

function normalizeSegment(value: string) {
  return value.replace(LEADING_SLASH_RE, '').replace(TRAILING_SLASH_RE, '')
}

function pushUnique(list: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  list.push(value)
}

async function waitForPageRoot(page: any, timeoutMs = 12_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    if (typeof page?.$$ === 'function') {
      try {
        const roots = await page.$$('page')
        if (Array.isArray(roots) && roots.length > 0) {
          return roots[0]
        }
      }
      catch {
      }
    }
    const element = await page.$('page')
    if (element) {
      return element
    }
    await page.waitFor(200)
  }
  return null
}

async function loadAppConfig(templateRoot: string) {
  const distAppJsonPath = path.resolve(templateRoot, DIST_APP_JSON_PATH)
  if (await pathExists(distAppJsonPath)) {
    return await readJson<Record<string, any>>(distAppJsonPath)
  }

  const appJsonPath = path.resolve(templateRoot, APP_JSON_PATH)
  if (await pathExists(appJsonPath)) {
    const raw = await readFile(appJsonPath, 'utf-8')
    const { parse: parseJson } = await import('comment-json')
    const config = parseJson(raw, undefined, true)
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config as Record<string, any>
    }
    throw new Error(`[${templateRoot}] app.json parse failed`)
  }

  const appVuePath = path.resolve(templateRoot, APP_VUE_PATH)
  if (await pathExists(appVuePath)) {
    const config = await extractConfigFromVue(appVuePath)
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config
    }
    throw new Error(`[${templateRoot}] app.vue defineAppJson extract failed`)
  }

  throw new Error(`[${templateRoot}] missing src/app.json or src/app.vue`)
}

function resolvePages(config: Record<string, any>) {
  const pages: string[] = []
  const seen = new Set<string>()

  if (Array.isArray(config.pages)) {
    for (const page of config.pages) {
      if (typeof page !== 'string') {
        continue
      }
      pushUnique(pages, seen, normalizeSegment(page))
    }
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string' ? normalizeSegment(subPackage.root) : ''
    const subPages = Array.isArray(subPackage.pages) ? subPackage.pages : []
    for (const page of subPages) {
      if (typeof page !== 'string') {
        continue
      }
      const normalizedPage = normalizeSegment(page)
      if (!normalizedPage) {
        continue
      }
      const combined = root ? `${root}/${normalizedPage}` : normalizedPage
      if (root && normalizedPage.startsWith(`${root}/`)) {
        pushUnique(pages, seen, normalizedPage)
      }
      else {
        pushUnique(pages, seen, combined)
      }
    }
  }

  return pages
}

async function runBuild(templateRoot: string) {
  const packageJsonPath = path.resolve(templateRoot, 'package.json')
  const packageJson = await readJson<Record<string, any>>(packageJsonPath)
  const hasDependencies = packageJson?.dependencies && Object.keys(packageJson.dependencies).length > 0
  const outputRoot = path.join(templateRoot, 'dist')
  const npmOutputRoot = path.join(outputRoot, 'miniprogram_npm')
  const hasPrebuiltNpm = await pathExists(npmOutputRoot)
  const tailwindPatchCacheRoot = path.join(templateRoot, 'node_modules/.cache/weapp-tailwindcss')

  await rm(tailwindPatchCacheRoot, {
    force: true,
    recursive: true,
  })

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: templateRoot,
    platform: 'weapp',
    cwd: templateRoot,
    label: `ide:${path.basename(templateRoot)}`,
    skipNpm: !hasDependencies || hasPrebuiltNpm,
  })
}

export async function runTemplateE2E(options: TemplateE2EOptions) {
  const { templateRoot, templateName } = options
  debugTemplateE2E(templateName, 'start')
  await runBuild(templateRoot)
  debugTemplateE2E(templateName, 'build-done')
  const config = await loadAppConfig(templateRoot)
  debugTemplateE2E(templateName, 'config-loaded')
  const pages = resolvePages(config)
  debugTemplateE2E(templateName, 'pages-resolved', `count=${pages.length}`)

  if (pages.length === 0) {
    throw new Error(`[${templateName}] No pages found in app config`)
  }

  const appWxssPath = path.join(templateRoot, 'dist', 'app.wxss')
  if (!(await pathExists(appWxssPath))) {
    throw new Error(`[${templateName}] Missing app.wxss in dist output`)
  }
  const appWxss = await readFile(appWxssPath, 'utf-8')
  expect(await formatWxss(appWxss)).toMatchSnapshot(`${templateName}::app.wxss`)
  debugTemplateE2E(templateName, 'app-wxss-snapshot-done')

  debugTemplateE2E(templateName, 'automator-launching')
  const miniProgram = await launchAutomator({
    projectPath: templateRoot,
  })

  try {
    debugTemplateE2E(templateName, 'automator-launched')
    for (const pagePath of pages) {
      const route = `/${pagePath}`
      debugTemplateE2E(templateName, 'page-relaunch', route)
      let page = await miniProgram.reLaunch(route)
      if (!page) {
        page = await miniProgram.reLaunch(route)
      }
      if (!page) {
        throw new Error(`[${templateName}] Failed to launch page: ${route}`)
      }

      const element = await waitForPageRoot(page)
      debugTemplateE2E(templateName, 'page-root-checked', `${route} found=${String(Boolean(element))}`)
      if (!element) {
        throw new Error(`[${templateName}] Failed to find page element: ${route}`)
      }

      const wxml = normalizeWxmlForSnapshot(await element.wxml())
      debugTemplateE2E(templateName, 'page-wxml-read', route)
      expect(await formatWxml(wxml)).toMatchSnapshot(`${templateName}::${pagePath}`)
      debugTemplateE2E(templateName, 'page-snapshot-done', route)
    }
  }
  finally {
    debugTemplateE2E(templateName, 'automator-closing')
    await miniProgram.close()
    debugTemplateE2E(templateName, 'automator-closed')
  }
}
