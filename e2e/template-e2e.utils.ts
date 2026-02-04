import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import prettier from 'prettier'
import { expect } from 'vitest'
import { extractConfigFromVue } from '../packages/weapp-vite/src/utils/file'
import { launchAutomator } from './utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_JSON_PATH = 'src/app.json'
const APP_VUE_PATH = 'src/app.vue'

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

export async function formatWxss(wxss: string) {
  return await prettier.format(wxss, {
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

function stripAutomatorOverlay(wxml: string) {
  // Strip devtools overlay styles appended by automator.
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeWxml(wxml: string) {
  const cleaned = stripAutomatorOverlay(wxml)
    .replace(/\s+(?:@tap|bind:tap|bindtap)=["'][^"']*["']/g, '')
    // Normalize invalid void-element markup from devtools.
    .replace(/<input\b([^>]*)>([\s\S]*?)<\/input>/gi, '<input$1 />$2')

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
    // Normalize tabs track translateX variations.
    .replace(/translateX\([\d.]+px\)/g, 'translateX(187px)')

  return normalizedTabs
}

function normalizeSegment(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function pushUnique(list: string[], seen: Set<string>, value: string) {
  if (!value || seen.has(value)) {
    return
  }
  seen.add(value)
  list.push(value)
}

async function loadAppConfig(templateRoot: string) {
  const appJsonPath = path.resolve(templateRoot, APP_JSON_PATH)
  if (await fs.pathExists(appJsonPath)) {
    const raw = await fs.readFile(appJsonPath, 'utf-8')
    const { parse: parseJson } = await import('comment-json')
    const config = parseJson(raw, undefined, true)
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return config as Record<string, any>
    }
    throw new Error(`[${templateRoot}] app.json parse failed`)
  }

  const appVuePath = path.resolve(templateRoot, APP_VUE_PATH)
  if (await fs.pathExists(appVuePath)) {
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
  const packageJson = await fs.readJson(packageJsonPath)
  const hasDependencies = packageJson?.dependencies && Object.keys(packageJson.dependencies).length > 0
  const outputRoot = path.join(templateRoot, 'dist')
  const npmOutputRoot = path.join(outputRoot, 'miniprogram_npm')
  const hasPrebuiltNpm = await fs.pathExists(npmOutputRoot)
  const args = [CLI_PATH, 'build', templateRoot, '--platform', 'weapp']
  if (!hasDependencies || hasPrebuiltNpm) {
    args.push('--skipNpm')
  }
  await execa('node', args, {
    stdio: 'inherit',
    cwd: templateRoot,
  })
}

export async function runTemplateE2E(options: TemplateE2EOptions) {
  const { templateRoot, templateName } = options
  const config = await loadAppConfig(templateRoot)
  const pages = resolvePages(config)

  if (pages.length === 0) {
    throw new Error(`[${templateName}] No pages found in app config`)
  }

  await runBuild(templateRoot)

  const appWxssPath = path.join(templateRoot, 'dist', 'app.wxss')
  if (!(await fs.pathExists(appWxssPath))) {
    throw new Error(`[${templateName}] Missing app.wxss in dist output`)
  }
  const appWxss = await fs.readFile(appWxssPath, 'utf-8')
  expect(await formatWxss(appWxss)).toMatchSnapshot(`${templateName}::app.wxss`)

  const miniProgram = await launchAutomator({
    projectPath: templateRoot,
  })

  try {
    for (const pagePath of pages) {
      const route = `/${pagePath}`
      const page = await miniProgram.reLaunch(route)
      if (!page) {
        throw new Error(`[${templateName}] Failed to launch page: ${route}`)
      }

      const element = await page.$('page')
      if (!element) {
        throw new Error(`[${templateName}] Failed to find page element: ${route}`)
      }

      const wxml = normalizeWxml(await element.wxml())
      expect(await formatWxml(wxml)).toMatchSnapshot(`${templateName}::${pagePath}`)
    }
  }
  finally {
    await miniProgram.close()
  }
}
