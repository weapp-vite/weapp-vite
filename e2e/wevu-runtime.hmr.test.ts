import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { APP_ROOT, CLI_PATH, DIST_ROOT, waitForFile } from './wevu-runtime.utils'

const SUPPORTED_PLATFORMS = ['weapp', 'alipay', 'tt'] as const
type RuntimePlatform = typeof SUPPORTED_PLATFORMS[number]
const PLATFORM_TEMPLATE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxml',
  alipay: 'axml',
  tt: 'ttml',
}
const HMR_SOURCE_TEMPLATE_PATH = path.join(APP_ROOT, 'src/pages/hmr/index.wxml')

function resolvePlatforms() {
  const selected = process.env.E2E_PLATFORM
  if (!selected) {
    return [...SUPPORTED_PLATFORMS]
  }
  if (!SUPPORTED_PLATFORMS.includes(selected as RuntimePlatform)) {
    throw new Error(`Unsupported E2E_PLATFORM: ${selected}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`)
  }
  return [selected as RuntimePlatform]
}

async function waitForFileContains(filePath: string, marker: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (content.includes(marker)) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${filePath} to contain marker: ${marker}`)
}

const PLATFORM_LIST = resolvePlatforms()

describe.sequential('wevu runtime hmr (dev watch)', () => {
  it.each(PLATFORM_LIST)('updates dist template after source change (%s)', async (platform) => {
    await fs.remove(DIST_ROOT)
    const originalSource = await fs.readFile(HMR_SOURCE_TEMPLATE_PATH, 'utf8')
    const distTemplatePath = path.join(DIST_ROOT, `pages/hmr/index.${PLATFORM_TEMPLATE_EXT[platform]}`)
    const marker = `HMR-HOT-${platform.toUpperCase()}`

    const updatedSource = originalSource.replace('HMR', marker)
    if (updatedSource === originalSource) {
      throw new Error('Failed to update hmr source marker.')
    }

    const dev = execa('node', ['--import', 'tsx', CLI_PATH, 'dev', APP_ROOT, '--platform', platform, '--skipNpm'], {
      stdio: 'pipe',
    })
    const devExit = dev.catch(() => {})

    try {
      await waitForFile(path.join(DIST_ROOT, 'app.json'), 120_000)
      await waitForFileContains(distTemplatePath, 'HMR')

      await fs.writeFile(HMR_SOURCE_TEMPLATE_PATH, updatedSource, 'utf8')

      const nextTemplate = await waitForFileContains(distTemplatePath, marker)
      expect(nextTemplate).toContain(marker)
    }
    finally {
      dev.kill('SIGTERM')
      const killTimer = setTimeout(() => {
        dev.kill('SIGKILL')
      }, 5_000)
      await devExit
      clearTimeout(killTimer)

      await fs.writeFile(HMR_SOURCE_TEMPLATE_PATH, originalSource, 'utf8')
    }
  })
})
