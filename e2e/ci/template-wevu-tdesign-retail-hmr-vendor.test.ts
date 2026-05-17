import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { waitForFile } from '../wevu-runtime.utils'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const HOME_SOURCE_PATH = path.join(TEMPLATE_ROOT, 'src/pages/home/home.vue')
const HOME_WXML_PATH = path.join(DIST_ROOT, 'pages/home/home.wxml')
const HOME_JSON_PATH = path.join(DIST_ROOT, 'pages/home/home.json')
const INITIAL_RETAIL_BUILD_TIMEOUT_MS = 180_000
const SEARCH_PLACEHOLDER_RE = /placeholder="iphone 13 火热发售中[^"]*"/
const PAGE_TITLE_RE = /navigationBarTitleText:\s*'[^']*'/
const REQUIRE_VENDOR_MEMBER_RE = /require\("([^"]*weapp-vendors\/[^"]+\.js)"\)\.([A-Za-z_$][\w$]*)/g
const VENDOR_MEMBER_RE = /const\s+([A-Za-z_$][\w$]*)\s*=\s*require\("([^"]*weapp-vendors\/[^"]+\.js)"\)/g

async function collectDistJsFiles() {
  const files = await fs.readdir(DIST_ROOT, { recursive: true })
  return files
    .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
    .map(file => path.join(DIST_ROOT, file))
}

async function collectVendorExports(vendorPath: string) {
  const source = await fs.readFile(vendorPath, 'utf8')
  return new Set(
    [...source.matchAll(/Object\.defineProperty\(exports,\s*"([^"]+)"/g)]
      .map(match => match[1])
      .filter((name): name is string => Boolean(name)),
  )
}

async function collectMissingVendorMembers(jsPath: string) {
  const source = await fs.readFile(jsPath, 'utf8')
  const missing: string[] = []
  const vendorVariables = new Map<string, string>()

  for (const match of source.matchAll(VENDOR_MEMBER_RE)) {
    const [, variableName, request] = match
    if (variableName && request) {
      vendorVariables.set(variableName, request)
    }
  }

  const usedMembers: Array<{ request: string, member: string }> = []
  for (const match of source.matchAll(REQUIRE_VENDOR_MEMBER_RE)) {
    const [, request, member] = match
    if (request && member) {
      usedMembers.push({ request, member })
    }
  }

  for (const [variableName, request] of vendorVariables) {
    const memberRe = new RegExp(`\\b${variableName.replaceAll('$', '\\$')}\\.([A-Za-z_$][\\w$]*)`, 'g')
    for (const match of source.matchAll(memberRe)) {
      const member = match[1]
      if (member) {
        usedMembers.push({ request, member })
      }
    }
  }

  const exportCache = new Map<string, Set<string>>()
  for (const { request, member } of usedMembers) {
    const resolved = path.resolve(path.dirname(jsPath), request)
    if (!(await fs.pathExists(resolved))) {
      continue
    }
    let exports = exportCache.get(resolved)
    if (!exports) {
      exports = await collectVendorExports(resolved)
      exportCache.set(resolved, exports)
    }
    if (!exports.has(member)) {
      missing.push(`${path.relative(DIST_ROOT, resolved).replaceAll('\\', '/')}#${member}`)
    }
  }

  return [...new Set(missing)].sort()
}

async function collectMissingVendorMembersByFile() {
  const missingByFile: Record<string, string[]> = {}
  for (const jsPath of await collectDistJsFiles()) {
    if (jsPath.includes('/weapp-vendors/')) {
      continue
    }
    const missing = await collectMissingVendorMembers(jsPath)
    if (missing.length) {
      missingByFile[path.relative(DIST_ROOT, jsPath).replaceAll('\\', '/')] = missing
    }
  }
  return missingByFile
}

async function waitForVendorMembersIntact(timeoutMs = 90_000) {
  const start = Date.now()
  let lastMissing: Record<string, string[]> = {}

  while (Date.now() - start < timeoutMs) {
    lastMissing = await collectMissingVendorMembersByFile()
    if (Object.keys(lastMissing).length === 0) {
      return lastMissing
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for vendor members to stay exported: ${JSON.stringify(lastMissing)}`)
}

function replaceSearchPlaceholder(source: string, marker: string) {
  const updated = source.replace(SEARCH_PLACEHOLDER_RE, `placeholder="${marker}"`)
  if (updated === source) {
    throw new Error('Failed to replace retail home search placeholder.')
  }
  return updated
}

function replacePageTitle(source: string, marker: string) {
  const updated = source.replace(PAGE_TITLE_RE, `navigationBarTitleText: '${marker}'`)
  if (updated === source) {
    throw new Error('Failed to replace retail home definePageJson title.')
  }
  return updated
}

async function withRetailDevWatch<T>(
  task: (dev: ReturnType<typeof startDevProcess>) => Promise<T>,
) {
  await fs.remove(DIST_ROOT)

  const dev = startDevProcess('node', [CLI_PATH, 'dev', TEMPLATE_ROOT, '--platform', 'weapp'], {
    cwd: TEMPLATE_ROOT,
    env: createDevProcessEnv({ disableSidecarWatch: true }),
    all: true,
  })

  try {
    await dev.waitFor(
      waitForFile(path.join(DIST_ROOT, 'app.json'), INITIAL_RETAIL_BUILD_TIMEOUT_MS),
      'retail template app.json generated',
    )
    await dev.waitFor(
      waitForFile(path.join(DIST_ROOT, 'pages/home/home.js'), INITIAL_RETAIL_BUILD_TIMEOUT_MS),
      'retail template home.js generated',
    )
    await dev.waitFor(waitForVendorMembersIntact(), 'initial retail template vendor members')
    return await task(dev)
  }
  finally {
    await dev.stop(5_000)
  }
}

describe.sequential('retail template HMR keeps wevu vendor exports intact', () => {
  it('updates the home search placeholder without dropping vendor exports', async () => {
    const originalSource = await fs.readFile(HOME_SOURCE_PATH, 'utf8')
    const marker = 'iphone 13 火热发售中-e2e-template'
    const updatedSource = replaceSearchPlaceholder(originalSource, marker)

    try {
      await withRetailDevWatch(async (dev) => {
        await replaceFileByRename(HOME_SOURCE_PATH, updatedSource)

        const output = await dev.waitFor(
          waitForFileContains(HOME_WXML_PATH, marker),
          'updated retail home search placeholder',
        )
        expect(output).toContain(marker)
        expect(await dev.waitFor(waitForVendorMembersIntact(), 'retail template vendor members after placeholder HMR')).toEqual({})
      })
    }
    finally {
      await replaceFileByRename(HOME_SOURCE_PATH, originalSource)
    }
  })

  it('updates definePageJson metadata without dropping vendor exports', async () => {
    const originalSource = await fs.readFile(HOME_SOURCE_PATH, 'utf8')
    const marker = '首页都撒到-e2e-metadata'
    const updatedSource = replacePageTitle(originalSource, marker)

    try {
      await withRetailDevWatch(async (dev) => {
        await replaceFileByRename(HOME_SOURCE_PATH, updatedSource)

        const output = await dev.waitFor(
          waitForFileContains(HOME_JSON_PATH, marker),
          'updated retail home definePageJson metadata',
        )
        expect(output).toContain(marker)
        expect(await dev.waitFor(waitForVendorMembersIntact(), 'retail template vendor members after metadata HMR')).toEqual({})
      })
    }
    finally {
      await replaceFileByRename(HOME_SOURCE_PATH, originalSource)
    }
  })
})
