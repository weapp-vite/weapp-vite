import type { RuntimePlatform } from '../wevu-runtime.utils'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolvePlatformMatrix } from '../utils/platform-matrix'
import {
  DIST_ROOT,
  filterSnapshotPages,
  formatMarkup,
  formatStyle,
  loadAppConfig,
  readPageOutput,
  resolvePages,
  runBuild,

} from '../wevu-runtime.utils'

const PLATFORM_LIST = resolvePlatformMatrix<RuntimePlatform>([
  'weapp',
  'alipay',
  'tt',
], {
  localDefault: 'weapp',
})

const PLATFORM_STYLE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxss',
  alipay: 'acss',
  tt: 'ttss',
}

const SNAPSHOT_FILE_SUFFIX = new Map<RuntimePlatform, string>([
  ['weapp', 'weapp'],
  ['alipay', 'alipay'],
  ['tt', 'tt'],
])
const SNAPSHOT_CACHE = new Map<RuntimePlatform, Record<string, string>>()
const SINGLE_PLATFORM_RUN = typeof process.env.E2E_PLATFORM === 'string' && process.env.E2E_PLATFORM.length > 0

function parseSnapshotExports(source: string) {
  const snapshotData: Record<string, string> = Object.create(null)
  const matches = source.matchAll(/exports\[`([^`]+)`\] = `([\s\S]*?)`;/g)
  for (const [, key, value] of matches) {
    snapshotData[key] = value
  }
  return snapshotData
}

function deserializeSnapshotValue(snapshotValue: string) {
  let normalized = snapshotValue
  if (normalized.startsWith('\n') && normalized.endsWith('\n')) {
    normalized = normalized.slice(1, -1)
  }
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1)
  }
  return normalized
}

async function loadPlatformSnapshots(platform: RuntimePlatform) {
  const cached = SNAPSHOT_CACHE.get(platform)
  if (cached) {
    return cached
  }

  const suffix = SNAPSHOT_FILE_SUFFIX.get(platform)
  if (!suffix) {
    throw new Error(`Unsupported snapshot platform: ${platform}`)
  }

  const snapshotPath = path.join(
    import.meta.dirname,
    '__snapshots__',
    `wevu-runtime.platforms.test.ts.${suffix}.snap`,
  )
  const snapshotSource = await fs.readFile(snapshotPath, 'utf-8')
  const snapshotData = parseSnapshotExports(snapshotSource)
  SNAPSHOT_CACHE.set(platform, snapshotData)
  return snapshotData
}

async function expectPlatformSnapshot(platform: RuntimePlatform, key: string, value: string) {
  if (!SINGLE_PLATFORM_RUN) {
    expect(value).toMatchSnapshot(key)
    return
  }

  const snapshotData = await loadPlatformSnapshots(platform)
  const currentTestName = expect.getState().currentTestName
  const snapshotKey = `${currentTestName} > ${key} 1`
  expect(snapshotData[snapshotKey]).toBeDefined()
  expect(value).toBe(deserializeSnapshotValue(snapshotData[snapshotKey]))
}

describe.sequential('wevu runtime platform outputs', () => {
  it.each(PLATFORM_LIST)('builds and snapshots %s outputs', async (platform) => {
    const config = await loadAppConfig()
    const pages = filterSnapshotPages(resolvePages(config))

    await runBuild(platform)

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    expect(await fs.pathExists(appJsonPath)).toBe(true)

    const appStylePath = path.join(DIST_ROOT, `app.${PLATFORM_STYLE_EXT[platform]}`)
    if (await fs.pathExists(appStylePath)) {
      const appStyle = await fs.readFile(appStylePath, 'utf-8')
      await expectPlatformSnapshot(platform, `wevu-runtime::${platform}::app.style`, await formatStyle(appStyle))
    }

    for (const pagePath of pages) {
      const { template, style } = await readPageOutput(platform, pagePath)
      await expectPlatformSnapshot(platform, `wevu-runtime::${platform}::${pagePath}`, await formatMarkup(template))
      await expectPlatformSnapshot(platform, `wevu-runtime::${platform}::${pagePath}.style`, await formatStyle(style))

      if (pagePath === 'pages/root-guard/index') {
        const scriptPath = path.join(DIST_ROOT, `${pagePath}.js`)
        const scriptSource = await fs.readFile(scriptPath, 'utf-8')
        expect(scriptSource).toMatch(/this\.root(?:\)\.a|\.a)/)
        expect(scriptSource).toMatch(/try\s*\{return/)
        expect(scriptSource).toMatch(/catch(?:\([^)]*\))?\{return``\}/)
      }
    }

    const commonScriptPath = path.join(DIST_ROOT, 'common.js')
    if (await fs.pathExists(commonScriptPath)) {
      const commonScript = await fs.readFile(commonScriptPath, 'utf-8')
      expect(commonScript).toContain(`MP_PLATFORM:\`${platform}\``)
      expect(commonScript).toContain(`PLATFORM:\`${platform}\``)

      if (platform === 'tt') {
        expect(commonScript).toMatch(/\?\.tt\b|\.tt\b|[`'"]tt[`'"]/)
      }

      if (platform === 'alipay') {
        expect(commonScript).toMatch(/\?\.my\b|\.my\b|[`'"]my[`'"]/)
      }
    }
  })
})
