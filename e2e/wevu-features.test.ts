import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { launchAutomator } from './utils/automator'

const CLI_PATH = path.resolve(import.meta.dirname, '../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../e2e-apps/wevu-features')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
}

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function readClassName(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('class') ?? '')
}

async function readStyleValue(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find element: ${selector}`)
  }
  return normalizeValue(await element.attribute('style') ?? '')
}

async function tapControlUntil(page: any, tapSelector: string, checker: () => Promise<boolean>) {
  const controlElement = await page.$(tapSelector)
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await controlElement.tap()
      return
    }
    if (mode === 'trigger') {
      await controlElement.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await controlElement.touchstart()
      await controlElement.touchend()
      return
    }
    await controlElement.dispatchEvent({ eventName: 'tap' })
  }

  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    for (let index = 0; index < 2; index += 1) {
      try {
        await fireTapLikeEvent(mode)
      }
      catch {
      }

      await page.waitFor(220)
      if (await checker()) {
        return true
      }
    }
  }

  return checker()
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: wevu-features', () => {
  it('builds useAttrs showcase app and emits expected outputs', async () => {
    await runBuild()

    const appJsonPath = path.join(DIST_ROOT, 'app.json')
    const indexWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const indexJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const useAttrsPageWxmlPath = path.join(DIST_ROOT, 'pages/use-attrs/index.wxml')
    const useAttrsPageJsPath = path.join(DIST_ROOT, 'pages/use-attrs/index.js')
    const useAttrsFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-attrs-feature/index.wxml')

    expect(await fs.pathExists(appJsonPath)).toBe(true)
    expect(await fs.pathExists(indexWxmlPath)).toBe(true)
    expect(await fs.pathExists(indexJsPath)).toBe(true)
    expect(await fs.pathExists(useAttrsPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useAttrsPageJsPath)).toBe(true)
    expect(await fs.pathExists(useAttrsFeatureWxmlPath)).toBe(true)

    const appJson = await fs.readJson(appJsonPath)
    const indexWxml = await fs.readFile(indexWxmlPath, 'utf8')
    const indexJs = await fs.readFile(indexJsPath, 'utf8')
    const useAttrsPageWxml = await fs.readFile(useAttrsPageWxmlPath, 'utf8')
    const useAttrsPageJs = await fs.readFile(useAttrsPageJsPath, 'utf8')
    const useAttrsFeatureWxml = await fs.readFile(useAttrsFeatureWxmlPath, 'utf8')

    expect(appJson.pages).toEqual([
      'pages/index/index',
      'pages/use-attrs/index',
      'pages/use-slots/index',
      'pages/use-model/index',
    ])

    expect(indexWxml).toContain('url="{{item.path}}"')
    expect(indexJs).toContain('/pages/use-attrs/index')
    expect(indexJs).toContain('/pages/use-slots/index')
    expect(indexJs).toContain('/pages/use-model/index')
    expect(indexJs).toContain('useAttrs')
    expect(indexJs).toContain('useSlots')
    expect(indexJs).toContain('useModel')

    expect(useAttrsPageWxml).toContain('<UseAttrsFeature')
    expect(useAttrsPageWxml).toContain('stateClass="{{currentToneClass}}"')
    expect(useAttrsPageWxml).toContain('visible="{{controlState.visible}}"')
    expect(useAttrsPageWxml).toContain('badgeStyle="{{currentBadgeStyle}}"')
    expect(useAttrsPageWxml).toContain('extraLabel="{{currentExtraLabel}}"')
    expect(useAttrsPageWxml).toContain('seedTag="{{controlState.seed}}"')
    expect(useAttrsPageWxml).toContain('bindtap="cycleToneClass"')
    expect(useAttrsPageWxml).toContain('bindtap="toggleVisible"')
    expect(useAttrsPageWxml).toContain('bindtap="toggleStrongBorder"')
    expect(useAttrsPageWxml).toContain('bindtap="bumpSeed"')

    expect(useAttrsPageJs).toContain('controlState')
    expect(useAttrsPageJs).toContain('runE2E')
    expect(useAttrsPageJs).toContain('_runE2E')

    expect(useAttrsFeatureWxml).toContain('wx:if="{{visible}}"')
    expect(useAttrsFeatureWxml).toContain('wx:for="{{attrRows}}"')
    expect(useAttrsFeatureWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)

    const useSlotsPageWxmlPath = path.join(DIST_ROOT, 'pages/use-slots/index.wxml')
    const useSlotsPageJsPath = path.join(DIST_ROOT, 'pages/use-slots/index.js')
    const useSlotsFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-slots-feature/index.wxml')

    const useModelPageWxmlPath = path.join(DIST_ROOT, 'pages/use-model/index.wxml')
    const useModelPageJsPath = path.join(DIST_ROOT, 'pages/use-model/index.js')
    const useModelFeatureWxmlPath = path.join(DIST_ROOT, 'components/use-model-feature/index.wxml')

    expect(await fs.pathExists(useSlotsPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useSlotsPageJsPath)).toBe(true)
    expect(await fs.pathExists(useSlotsFeatureWxmlPath)).toBe(true)
    expect(await fs.pathExists(useModelPageWxmlPath)).toBe(true)
    expect(await fs.pathExists(useModelPageJsPath)).toBe(true)
    expect(await fs.pathExists(useModelFeatureWxmlPath)).toBe(true)

    const useSlotsPageWxml = await fs.readFile(useSlotsPageWxmlPath, 'utf8')
    const useSlotsPageJs = await fs.readFile(useSlotsPageJsPath, 'utf8')
    const useSlotsFeatureWxml = await fs.readFile(useSlotsFeatureWxmlPath, 'utf8')
    const useModelPageWxml = await fs.readFile(useModelPageWxmlPath, 'utf8')
    const useModelPageJs = await fs.readFile(useModelPageJsPath, 'utf8')
    const useModelFeatureWxml = await fs.readFile(useModelFeatureWxmlPath, 'utf8')

    expect(useSlotsPageWxml).toContain('<UseSlotsFeature')
    expect(useSlotsPageWxml).toContain('bindtap="toggleOpen"')
    expect(useSlotsPageWxml).toContain('bindtap="toggleHeader"')
    expect(useSlotsPageWxml).toContain('bindtap="bumpCount"')
    expect(useSlotsPageJs).toContain('_runE2E')
    expect(useSlotsFeatureWxml).toContain('id="slots-panel"')
    expect(useSlotsFeatureWxml).toContain('id="slots-summary"')

    expect(useModelPageWxml).toContain('<UseModelFeature')
    expect(useModelPageWxml).toContain('model-value="{{modelValue}}"')
    expect(useModelPageWxml).toContain('bind:update:modelValue="__weapp_vite_inline"')
    expect(useModelPageWxml).toContain('bindtap="setParentAlpha"')
    expect(useModelPageWxml).toContain('bindtap="setParentBeta"')
    expect(useModelPageJs).toContain('_runE2E')
    expect(useModelFeatureWxml).toContain('id="model-inner-value"')
    expect(useModelFeatureWxml).toContain('bindtap="__weapp_vite_inline"')
  })

  it('updates runtime class and style via pure click controls', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const page = await miniProgram.reLaunch('/pages/use-attrs/index')
      if (!page) {
        throw new Error('Failed to launch use-attrs page')
      }

      await page.waitFor(500)

      const visibleToggleButton = await page.$('#ctrl-toggle-visible')
      const toneButton = await page.$('#ctrl-cycle-tone')
      const borderButton = await page.$('#ctrl-toggle-border')
      const seedButton = await page.$('#ctrl-bump-seed')

      if (!visibleToggleButton || !toneButton || !borderButton || !seedButton) {
        throw new Error('Failed to find useAttrs runtime elements')
      }

      const beforeWxml = await readPageWxml(page)
      const beforeToneClass = await readClassName(page, '#ctrl-cycle-tone')
      const beforeVisibleClass = await readClassName(page, '#ctrl-toggle-visible')
      const beforeBorderClass = await readClassName(page, '#ctrl-toggle-border')
      const beforeBorderStyle = await readStyleValue(page, '#ctrl-toggle-border')

      expect(beforeToneClass).toContain('tone-blue')
      expect(beforeVisibleClass).toContain('ctrl-on')
      expect(beforeBorderClass).toContain('ctrl-dash')
      expect(beforeBorderStyle).toContain('dashed')
      expect(beforeWxml).toContain('组件内 useAttrs()')
      expect(beforeWxml).toContain('递增 seed：1')
      expect(beforeWxml).toContain('切换 visible：true')
      expect(beforeWxml).toContain('state-class = tone-blue')
      expect(beforeWxml).toContain('visible = true')
      expect(beforeWxml).toContain('extra-label = seed-1')
      expect(beforeWxml).toContain('state-class: tone-blue')
      expect(beforeWxml).toContain('visible: true')

      const toneApplied = await tapControlUntil(page, '#ctrl-cycle-tone', async () => {
        const afterToneWxml = await readPageWxml(page)
        return afterToneWxml.includes('切换 tone：tone-green')
          && afterToneWxml.includes('state-class = tone-green')
          && afterToneWxml.includes('state-class: tone-green')
      })
      expect(toneApplied).toBe(true)
      const afterToneClass = await readClassName(page, '#ctrl-cycle-tone')
      expect(afterToneClass).toContain('tone-green')
      expect(afterToneClass).not.toBe(beforeToneClass)

      const borderApplied = await tapControlUntil(page, '#ctrl-toggle-border', async () => {
        const afterBorderWxml = await readPageWxml(page)
        return afterBorderWxml.includes('边框模式：strong')
          && afterBorderWxml.includes('state-class = tone-green')
          && afterBorderWxml.includes('solid')
          && afterBorderWxml.includes('badge-style: border: 2rpx solid')
      })
      expect(borderApplied).toBe(true)
      const afterBorderClass = await readClassName(page, '#ctrl-toggle-border')
      const afterBorderStyle = await readStyleValue(page, '#ctrl-toggle-border')
      expect(afterBorderClass).toContain('ctrl-solid')
      expect(afterBorderClass).not.toContain('ctrl-dash')
      expect(afterBorderStyle).toContain('solid')
      expect(afterBorderStyle).not.toBe(beforeBorderStyle)

      const seedBumped = await tapControlUntil(page, '#ctrl-bump-seed', async () => {
        const afterSeedWxml = await readPageWxml(page)
        return afterSeedWxml.includes('递增 seed：2') && afterSeedWxml.includes('extra-label = seed-2')
      })
      expect(seedBumped).toBe(true)

      const visibleToggled = await tapControlUntil(page, '#ctrl-toggle-visible', async () => {
        const afterVisibleWxml = await readPageWxml(page)
        return afterVisibleWxml.includes('切换 visible：false')
          && afterVisibleWxml.includes('visible = false')
          && !afterVisibleWxml.includes('id="attrs-extra"')
      })
      expect(visibleToggled).toBe(true)

      const afterVisibleClass = await readClassName(page, '#ctrl-toggle-visible')
      expect(afterVisibleClass).toContain('ctrl-off')

      const finalWxml = await readPageWxml(page)
      expect(finalWxml).toContain('visible: false')
      expect(finalWxml).not.toContain('is-on')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('updates runtime slots and model pages', async () => {
    await runBuild()

    const miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })

    try {
      const slotsPage = await miniProgram.reLaunch('/pages/use-slots/index')
      if (!slotsPage) {
        throw new Error('Failed to launch use-slots page')
      }

      await slotsPage.waitFor(500)
      const slotsResult = await slotsPage.callMethod('runE2E')
      expect(slotsResult?.ok).toBe(true)
      expect(slotsResult?.checks?.openChanged).toBe(true)
      expect(slotsResult?.checks?.headerChanged).toBe(true)
      expect(slotsResult?.checks?.countChanged).toBe(true)
      const slotsWxml = await readPageWxml(slotsPage)
      expect(slotsWxml).toContain('slots: []')

      const modelPage = await miniProgram.reLaunch('/pages/use-model/index')
      if (!modelPage) {
        throw new Error('Failed to launch use-model page')
      }

      await modelPage.waitFor(500)

      const modelResult = await modelPage.callMethod('runE2E')
      expect(modelResult?.ok).toBe(true)
      expect(modelResult?.checks?.valueChanged).toBe(true)
      expect(modelResult?.checks?.logsChanged).toBe(true)

      const parentValueBefore = await readPageWxml(modelPage)
      expect(parentValueBefore).toContain('parent modelValue = alpha-from-parent')

      const parentSetOk = await tapControlUntil(modelPage, '#model-parent-beta', async () => {
        const wxml = await readPageWxml(modelPage)
        return wxml.includes('parent modelValue = beta-from-parent')
      })
      expect(parentSetOk).toBe(true)
    }
    finally {
      await miniProgram.close()
    }
  })
})
