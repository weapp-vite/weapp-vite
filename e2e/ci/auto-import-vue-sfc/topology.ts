import type { RuntimePlatform } from './helpers'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect } from 'vitest'
import { startDevProcess } from '../../utils/dev-process'
import { createDevProcessEnv } from '../../utils/dev-process-env'
import {
  expectFullScanHmrEmit,
  expectPageComponentAssets,
  expectTargetedHmrEmit,
  FULL_SCAN_HMR_EMIT_RE,
  insertStandaloneTagAfter,
  insertVueTemplateHeartbeat,
  PLATFORM_TEMPLATE_EXT,
  removeStandaloneTagLine,
  resolveVueComponentKey,
  TARGETED_HMR_EMIT_RE,
  toCrlf,
  waitForFileContains,
  waitForMissingUsingComponent,
  waitForOutputSince,
  waitForTaskWithSourceHeartbeat,
  waitForUsingComponent,
} from './helpers'

/** 组件集合变化重新发现完整引用图；相同集合的内容编辑仍保持定向发射。 */
export async function runAutoImportTopologyScenario(options: {
  appRoot: string
  cliPath: string
  platform: RuntimePlatform
  crlf?: boolean
}) {
  const { appRoot, cliPath, platform, crlf = false } = options
  const distRoot = path.join(appRoot, 'dist')
  const pageSourcePath = path.join(appRoot, 'src/pages/index/index.vue')
  await fs.remove(distRoot)

  const originalPageSource = await fs.readFile(pageSourcePath, 'utf8')
  const initialPageSource = crlf ? toCrlf(originalPageSource) : originalPageSource
  const pageSourceWithoutAutoCard = removeStandaloneTagLine(initialPageSource, 'AutoCard')
  const pageSourceWithAutoCard = insertStandaloneTagAfter(
    pageSourceWithoutAutoCard,
    'ResolverCard',
    'AutoCard',
  )
  if (pageSourceWithoutAutoCard === initialPageSource || pageSourceWithAutoCard === pageSourceWithoutAutoCard) {
    throw new Error('Failed to create page source variants for AutoCard toggling.')
  }

  let devProcess: ReturnType<typeof startDevProcess> | undefined
  try {
    if (crlf) {
      await fs.writeFile(pageSourcePath, initialPageSource, 'utf8')
    }
    devProcess = startDevProcess(
      'node',
      ['--import', 'tsx', cliPath, 'dev', appRoot, '--platform', platform, '--skipNpm'],
      {
        env: {
          ...createDevProcessEnv(),
          DEBUG: 'weapp-vite:load-entry',
        },
        all: true,
      },
    )
    await devProcess.waitForInitialBuild()
    const pageJsonPath = path.join(distRoot, 'pages/index/index.json')
    const pageTemplatePath = path.join(distRoot, `pages/index/index.${PLATFORM_TEMPLATE_EXT[platform]}`)
    const autoCardKey = resolveVueComponentKey('AutoCard')
    await devProcess.waitFor(
      waitForUsingComponent(pageJsonPath, autoCardKey, '/components/AutoCard/index'),
      `${platform} initial autoCard registration`,
    )
    const initialPage = await expectPageComponentAssets(distRoot, pageJsonPath, platform)

    const outputLengthBeforeRemoval = devProcess.getOutput().length
    await fs.writeFile(pageSourcePath, pageSourceWithoutAutoCard, 'utf8')
    const removedPage = await devProcess.waitFor(
      waitForTaskWithSourceHeartbeat(
        () => waitForMissingUsingComponent(pageJsonPath, autoCardKey, 1_000),
        pageSourcePath,
        pageSourceWithoutAutoCard,
      ),
      `${platform} autoCard removal`,
    )
    expect(removedPage.usingComponents ?? {}).not.toHaveProperty(autoCardKey)
    expect(removedPage.usingComponents).toEqual(Object.fromEntries(
      Object.entries(initialPage.usingComponents ?? {}).filter(([name]) => name !== autoCardKey),
    ))
    const removalOutput = await devProcess.waitFor(
      waitForOutputSince(devProcess, outputLengthBeforeRemoval, FULL_SCAN_HMR_EMIT_RE),
      `${platform} autoCard removal complete scan`,
    )
    expectFullScanHmrEmit(removalOutput)
    await expectPageComponentAssets(distRoot, pageJsonPath, platform)

    const outputLengthBeforeRestore = devProcess.getOutput().length
    await fs.writeFile(pageSourcePath, pageSourceWithAutoCard, 'utf8')
    await devProcess.waitFor(
      waitForTaskWithSourceHeartbeat(
        () => waitForUsingComponent(pageJsonPath, autoCardKey, '/components/AutoCard/index', 1_000),
        pageSourcePath,
        pageSourceWithAutoCard,
      ),
      `${platform} autoCard re-registration`,
    )
    const restoreOutput = await devProcess.waitFor(
      waitForOutputSince(devProcess, outputLengthBeforeRestore, FULL_SCAN_HMR_EMIT_RE),
      `${platform} autoCard restore complete scan`,
    )
    expectFullScanHmrEmit(restoreOutput)
    const restoredPage = await expectPageComponentAssets(distRoot, pageJsonPath, platform)
    expect(restoredPage.usingComponents).toEqual(initialPage.usingComponents)

    const marker = `auto-import-content-${Date.now()}`
    const pageSourceWithText = insertVueTemplateHeartbeat(pageSourceWithAutoCard, marker, crlf ? '\r\n' : '\n')
    const outputLengthBeforeText = devProcess.getOutput().length
    await fs.writeFile(pageSourcePath, pageSourceWithText, 'utf8')
    await devProcess.waitFor(
      waitForFileContains(pageTemplatePath, [marker]),
      `${platform} same-topology content output`,
    )
    const textOutput = await devProcess.waitFor(
      waitForOutputSince(devProcess, outputLengthBeforeText, TARGETED_HMR_EMIT_RE),
      `${platform} same-topology targeted hmr log`,
    )
    expectTargetedHmrEmit(textOutput)
    expect(textOutput).not.toMatch(FULL_SCAN_HMR_EMIT_RE)
    const editedPage = await expectPageComponentAssets(distRoot, pageJsonPath, platform)
    expect(editedPage.usingComponents).toEqual(restoredPage.usingComponents)
  }
  finally {
    try {
      await devProcess?.stop(3_000)
    }
    finally {
      await fs.writeFile(pageSourcePath, originalPageSource, 'utf8')
    }
  }
}
