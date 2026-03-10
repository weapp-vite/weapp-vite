import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/github-issues')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)

  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    cwd: APP_ROOT,
    label: 'ide:github-issues',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(_miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === _miniProgram) {
    return
  }
  await _miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(/\s*\.luna-dom-highlighter[\s\S]*$/, '')
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

  return (await element.attribute('class') ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(/^\/+/, '')
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
      // 页面切换时 currentPage 可能短暂失败，继续轮询。
    }
    await delay(220)
  }
  return null
}

function expectPropsProbeCase(
  wxml: string,
  options: { caseId: string, boolText: 'true' | 'false', strText: string },
) {
  const { caseId, boolText, strText } = options
  const casePattern = escapeRegExp(caseId)
  const boolPattern = escapeRegExp(boolText)
  const strPattern = escapeRegExp(strText)

  const destructuredPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-destructured[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-destructured-bool="${boolPattern}")(?=[^>]*data-destructured-str="${strPattern}")[^>]*>`,
  )
  const propsPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-probe-props[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-props-bool="${boolPattern}")(?=[^>]*data-props-bool-raw="${boolPattern}")(?=[^>]*data-props-str="${strPattern}")[^>]*>`,
  )
  const strictPattern = new RegExp(
    `<text(?=[^>]*class="[^"]*issue300-strict-probe[^"]*")(?=[^>]*data-case-id="${casePattern}")(?=[^>]*data-strict-bool="${boolPattern}")(?=[^>]*data-strict-bool-raw="${boolPattern}")(?=[^>]*data-strict-str="${strPattern}")[^>]*>`,
  )

  expect(wxml).toMatch(destructuredPattern)
  expect(wxml).toMatch(propsPattern)
  expect(wxml).toMatch(strictPattern)
}

function normalizeClassValue(className: string) {
  return className.trim().replace(/\s+/g, ' ')
}

function readFirstClassFromWxmlByToken(wxml: string, token: string) {
  const escapedToken = escapeRegExp(token)
  const pattern = new RegExp(`<[^>]*\\bclass=(['"])([^'\"]*\\b${escapedToken}\\b[^'\"]*)\\1[^>]*>`, 'i')
  const className = pattern.exec(wxml)?.[2] ?? ''
  return normalizeClassValue(className)
}

async function tapControlAndReadClass(page: any, tapSelector: string, classSelector = tapSelector) {
  const controlElement = await page.$(tapSelector)
  if (!controlElement) {
    throw new Error(`Failed to find tap element: ${tapSelector}`)
  }

  const beforeClass = await readClassName(page, classSelector)

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
      const currentClass = await readClassName(page, classSelector)
      if (currentClass !== beforeClass) {
        return currentClass
      }
    }
  }

  return readClassName(page, classSelector)
}

async function tapElement(page: any, selector: string) {
  const element = await page.$(selector)
  if (!element) {
    throw new Error(`Failed to find tap element: ${selector}`)
  }

  async function fireTapLikeEvent(mode: 'tap' | 'trigger' | 'touch' | 'dispatch') {
    if (mode === 'tap') {
      await element.tap()
      return
    }
    if (mode === 'trigger') {
      await element.trigger('tap')
      return
    }
    if (mode === 'touch') {
      await element.touchstart()
      await element.touchend()
      return
    }
    await element.dispatchEvent({ eventName: 'tap' })
  }

  let lastError: unknown
  for (const mode of ['tap', 'trigger', 'touch', 'dispatch'] as const) {
    try {
      await fireTapLikeEvent(mode)
      await page.waitFor(240)
      return
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to tap element: ${selector}`)
}

describe.sequential('e2e app: github-issues', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('issue #289: updates runtime classes on split pages', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const objectPage = await miniProgram.reLaunch('/pages/issue-289/object-literal/index')
      if (!objectPage) {
        throw new Error('Failed to launch object-literal page')
      }
      await objectPage.waitFor(500)

      const objectInitialWxml = await readPageWxml(objectPage)
      expect(objectInitialWxml).toContain('object-list-loose')
      expect(objectInitialWxml).not.toContain('object list hidden')

      const objectResult = await objectPage.callMethod('runE2E')
      await objectPage.waitFor(400)
      expect(objectResult?.ok).toBe(true)
      expect(objectResult?.checks?.compactChanged).toBe(true)
      expect(objectResult?.checks?.activeChanged).toBe(true)
      expect(objectResult?.checks?.showListRoundTripWorked).toBe(true)
      expect(objectResult?.checks?.finalListVisible).toBe(true)
      expect(objectResult?.state?.compactMode).toBe(true)
      expect(objectResult?.state?.showList).toBe(true)
      expect(objectResult?.state?.activeIndex).toBe(1)

      const objectUpdatedWxml = await readPageWxml(objectPage)
      expect(objectUpdatedWxml).toContain('object-list-compact')
      expect(objectUpdatedWxml).not.toContain('object-list-loose')
      expect(objectUpdatedWxml).not.toContain('object list hidden')
      expect(objectUpdatedWxml).toContain('激活项：item-1')

      const mapPage = await miniProgram.reLaunch('/pages/issue-289/map-class/index')
      if (!mapPage) {
        throw new Error('Failed to launch map-class page')
      }
      await mapPage.waitFor(500)

      const mapInitialWxml = await readPageWxml(mapPage)
      expect(mapInitialWxml).toContain('issue289-map-toggle-expanded issue289-ctrl-on')
      expect(mapInitialWxml).toContain('issue289-map-toggle-list issue289-ctrl-on')
      expect(mapInitialWxml).toContain('issue289-map-cycle-selected issue289-cycle-1')
      expect(mapInitialWxml).toContain('map-meta-list-open')
      const mapListControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-list')
      const mapExpandedControlOnClass = await readClassName(mapPage, '.issue289-map-toggle-expanded')
      expect(mapListControlOnClass).toContain('issue289-ctrl-on')
      expect(mapExpandedControlOnClass).toContain('issue289-ctrl-on')

      const mapMetaListOnClass = readFirstClassFromWxmlByToken(mapInitialWxml, 'map-meta-list')
      expect(mapMetaListOnClass).toContain('map-meta-list-open')
      expect(mapMetaListOnClass).not.toContain('map-meta-list-closed')

      const mapExpandedControlOffClass = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-expanded',
        '.issue289-map-toggle-expanded',
      )
      expect(mapExpandedControlOffClass).toContain('issue289-ctrl-off')
      expect(mapExpandedControlOffClass).not.toContain('issue289-ctrl-on')

      const mapExpandedOffWxml = await readPageWxml(mapPage)
      expect(mapExpandedOffWxml).toContain('map-meta-list-open')

      const mapListControlOffClass = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-list',
        '.issue289-map-toggle-list',
      )
      expect(mapListControlOffClass).toContain('issue289-ctrl-off')
      expect(mapListControlOffClass).not.toContain('issue289-ctrl-on')

      const mapListOffWxml = await readPageWxml(mapPage)
      const mapMetaListOffClass = readFirstClassFromWxmlByToken(mapListOffWxml, 'map-meta-list')
      expect(mapMetaListOffClass).toContain('map-meta-list-closed')
      expect(mapMetaListOffClass).not.toContain('map-meta-list-open')
      expect(mapListOffWxml).not.toContain('event-chip-expanded')
      expect(mapListOffWxml).toContain('callout hidden')

      const mapListControlOnClassAfter = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-list',
        '.issue289-map-toggle-list',
      )
      expect(mapListControlOnClassAfter).toContain('issue289-ctrl-on')
      expect(mapListControlOnClassAfter).not.toContain('issue289-ctrl-off')

      const mapListOnWxml = await readPageWxml(mapPage)
      const mapMetaListOnClassAfter = readFirstClassFromWxmlByToken(mapListOnWxml, 'map-meta-list')
      expect(mapMetaListOnClassAfter).toContain('map-meta-list-open')
      expect(mapMetaListOnClassAfter).not.toContain('map-meta-list-closed')
      expect(mapListOnWxml).not.toContain('callout hidden')

      const mapExpandedControlOnClassAfter = await tapControlAndReadClass(
        mapPage,
        '.issue289-map-switch-expanded',
        '.issue289-map-toggle-expanded',
      )
      expect(mapExpandedControlOnClassAfter).toContain('issue289-ctrl-on')
      expect(mapExpandedControlOnClassAfter).not.toContain('issue289-ctrl-off')
      const mapExpandedOnWxml = await readPageWxml(mapPage)
      expect(mapExpandedOnWxml).toContain('map-meta-list-open')

      const rootPage = await miniProgram.reLaunch('/pages/issue-289/root-class/index')
      if (!rootPage) {
        throw new Error('Failed to launch root-class page')
      }
      await rootPage.waitFor(500)

      const rootInitialWxml = await readPageWxml(rootPage)
      expect(rootInitialWxml).toContain('root class: aaaa')

      const rootResult = await rootPage.callMethod('runE2E')
      await rootPage.waitFor(400)
      expect(rootResult?.ok).toBe(true)
      expect(rootResult?.checks?.selectedIndexChanged).toBe(true)
      expect(rootResult?.checks?.showOptionsChanged).toBe(true)
      expect(rootResult?.state?.showOptions).toBe(false)
      expect(rootResult?.state?.selectedIndex).toBe(1)

      const rootUpdatedWxml = await readPageWxml(rootPage)
      expect(rootUpdatedWxml).toContain('root class: bbbb')
      expect(rootUpdatedWxml).toContain('options hidden')
      expect(rootUpdatedWxml).toContain('选中类：root-b')

      const computedPage = await miniProgram.reLaunch('/pages/issue-289/computed-class/index')
      if (!computedPage) {
        throw new Error('Failed to launch computed-class page')
      }
      await computedPage.waitFor(500)

      const computedInitialWxml = await readPageWxml(computedPage)
      expect(computedInitialWxml).toContain('issue289-computed-toggle-source issue289-ctrl-on')
      expect(computedInitialWxml).toContain('issue289-computed-toggle-items issue289-ctrl-on')
      expect(computedInitialWxml).toContain('issue289-computed-cycle-selected issue289-cycle-0')

      const computedSourceOnClass = await readClassName(computedPage, '.issue289-computed-toggle-source')
      const computedItemsOnClass = await readClassName(computedPage, '.issue289-computed-toggle-items')
      expect(computedSourceOnClass).toContain('issue289-ctrl-on')
      expect(computedItemsOnClass).toContain('issue289-ctrl-on')
      const computedListOnClass = readFirstClassFromWxmlByToken(computedInitialWxml, 'computed-list')
      expect(computedListOnClass).toContain('computed-list')
      expect(
        computedListOnClass.includes('computed-list-enabled')
        || computedListOnClass.includes('computed-list-disabled'),
      ).toBe(true)

      const computedSourceOffClass = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-source',
        '.issue289-computed-toggle-source',
      )
      expect(computedSourceOffClass).toContain('issue289-ctrl-off')
      expect(computedSourceOffClass).not.toContain('issue289-ctrl-on')

      const computedSourceOffWxml = await readPageWxml(computedPage)
      const computedListDisabledClass = readFirstClassFromWxmlByToken(computedSourceOffWxml, 'computed-list')
      expect(computedListDisabledClass).toContain('computed-list')
      expect(computedListDisabledClass).not.toBe(computedListOnClass)

      const computedItemsOffClass = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-items',
        '.issue289-computed-toggle-items',
      )
      expect(computedItemsOffClass).toContain('issue289-ctrl-off')
      expect(computedItemsOffClass).not.toContain('issue289-ctrl-on')

      const computedItemsOffWxml = await readPageWxml(computedPage)
      const computedEmptyClass = readFirstClassFromWxmlByToken(computedItemsOffWxml, 'computed-empty')
      expect(computedEmptyClass).toContain('computed-empty-b')
      expect(computedItemsOffWxml).not.toContain('computed-list-enabled')
      expect(computedItemsOffWxml).not.toContain('computed-list-disabled')

      const computedItemsOnClassAfter = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-items',
        '.issue289-computed-toggle-items',
      )
      expect(computedItemsOnClassAfter).toContain('issue289-ctrl-on')
      expect(computedItemsOnClassAfter).not.toContain('issue289-ctrl-off')

      const computedItemsOnWxml = await readPageWxml(computedPage)
      const computedListDisabledClassAfter = readFirstClassFromWxmlByToken(computedItemsOnWxml, 'computed-list')
      expect(computedListDisabledClassAfter).toBe(computedListDisabledClass)

      const computedSourceOnClassAfter = await tapControlAndReadClass(
        computedPage,
        '.issue289-computed-switch-source',
        '.issue289-computed-toggle-source',
      )
      expect(computedSourceOnClassAfter).toContain('issue289-ctrl-on')
      expect(computedSourceOnClassAfter).not.toContain('issue289-ctrl-off')

      const computedSourceOnWxml = await readPageWxml(computedPage)
      const computedListEnabledClassAfter = readFirstClassFromWxmlByToken(computedSourceOnWxml, 'computed-list')
      expect(computedListEnabledClassAfter).toBe(computedListOnClass)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #297: compiles and renders complex call expressions', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 complex call expressions')
    expect(issuePageWxml).toContain('Case A · v-bind 调用表达式')
    expect(issuePageWxml).toContain('Case B · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case C · 多参数调用（含激活项）')
    expect(issuePageWxml).toContain('Case A(v-bind):')
    expect(issuePageWxml).toContain('Case B(v-if/v-for):')
    expect(issuePageWxml).toContain('Case C(多参数):')
    expect(issuePageWxml).toContain('新增列表项')
    expect(issuePageWxml).toContain('重置列表')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-title="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-hello="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/\{\{__wv_bind_\d+\[[^\]]+\]\}\}/)
    expect(issuePageWxml).not.toContain('sayHello(')
    const bindTokens = issuePageWxml.match(/__wv_bind_\d+/g) ?? []
    expect(new Set(bindTokens).size).toBeGreaterThanOrEqual(5)

    expect(issuePageJs).toMatch(/sayHello\)\(1,/)
    expect(issuePageJs).toContain('dasd')
    expect(issuePageJs).toContain('this.sayHello')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-297/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297 page')
      }
      await issuePage.waitFor(500)
      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('Hello-1-root-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Alpha-dasd')
      expect(initialRenderedWxml).toContain('Hello-1-Beta-dasd')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.root).toBe('Hello-1-root-dasd')
      expect(runtimeResult?.rendered).toEqual([
        'Hello-1-Alpha-dasd',
        'Hello-1-Beta-dasd',
      ])
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #297: setup method call variants remain stable across expression contexts', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-297-setup-method-calls/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-297 setup method call variants')
    expect(issuePageWxml).toContain('Case A · 插值调用 + 同级静态文本 + 同级元素')
    expect(issuePageWxml).toContain('Case B · v-bind 多参数调用')
    expect(issuePageWxml).toContain('Case C · v-if + v-for 调用表达式')
    expect(issuePageWxml).toContain('Case D · 成员调用 / 模板字符串 / 三元表达式')
    expect(issuePageWxml).toContain('Case E · 可选调用 + 空值兜底')
    expect(issuePageWxml).toMatch(/wx:if="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/wx:for="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-inline="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-multi="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-label="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-loop="\{\{__wv_bind_\d+\[[^\]]+\]\}\}"/)
    expect(issuePageWxml).toMatch(/data-member="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-template="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-ternary="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-wrap="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/data-optional="\{\{__wv_bind_\d+\}\}"/)
    expect(issuePageWxml).not.toContain('getCase()')
    expect(issuePageWxml).not.toContain('sayCase(')
    expect(issuePageWxml).not.toContain('getOptionalInvoker?.(')

    expect(issuePageJs).toContain('this.getCase')
    expect(issuePageJs).toContain('this.sayCase')
    expect(issuePageJs).toContain('this.getRows')
    expect(issuePageJs).toContain('this.getOptionalInvoker')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-297-setup-method-calls/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-297-setup-method-calls page')
      }
      await issuePage.waitFor(500)

      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('123')
      expect(initialRenderedWxml).toContain('11')
      expect(initialRenderedWxml).toContain('bind-Alpha-dasd')
      expect(initialRenderedWxml).toContain('data-loop="loop-Alpha-tail"')
      expect(initialRenderedWxml).toContain('data-member="MEMBER-ALPHA-TAIL"')
      expect(initialRenderedWxml).toContain('data-template="P-123"')
      expect(initialRenderedWxml).toContain('data-ternary="ternary-row-0-dasd"')
      expect(initialRenderedWxml).toContain('data-wrap="[wrap-row-0-tail]"')
      expect(initialRenderedWxml).toContain('data-optional="Maybe-row-0"')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.inlineValue).toBe('123')
      expect(runtimeResult?.bindValue).toBe('bind-Alpha-dasd')
      expect(runtimeResult?.loopValues).toEqual([
        'loop-Alpha-tail',
        'loop-Beta-tail',
      ])
      expect(runtimeResult?.templateLiteralValue).toBe('P-123')
      expect(runtimeResult?.memberValue).toBe('MEMBER-ALPHA-TAIL')
      expect(runtimeResult?.ternaryValue).toBe('ternary-row-0-dasd')
      expect(runtimeResult?.optionalValue).toBe('Maybe-row-0')

      await issuePage.callMethod('toggleOptionalInvoker')
      await issuePage.waitFor(300)
      const optionalDisabledWxml = await readPageWxml(issuePage)
      expect(optionalDisabledWxml).toContain('data-optional="none"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #302: updates v-for class bindings with active state changes', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-302/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-302/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-302 v-for class binding update')
    expect(issuePageWxml).toContain('active: {{active}}')
    expect(issuePageWxml).toContain('wx:for="{{tabs}}"')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\[(?:__wv_index_0|index)\]\}\}"/)
    expect(issuePageJs).toContain('setActive')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-302/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-302 page')
      }
      await issuePage.waitFor(500)

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.active).toBe('a')
      expect(await issuePage.data('active')).toBe('a')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-active',
        'issue302-item issue302-item-b issue302-item-inactive',
        'issue302-item issue302-item-c issue302-item-inactive',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-active')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-inactive')

      await issuePage.callMethod('setActive', 'b')
      await issuePage.waitFor(240)
      const switchedToBRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToBRuntime?.ok).toBe(true)
      expect(switchedToBRuntime?.active).toBe('b')
      expect(await issuePage.data('active')).toBe('b')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-inactive',
        'issue302-item issue302-item-b issue302-item-active',
        'issue302-item issue302-item-c issue302-item-inactive',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-active')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-inactive')

      await issuePage.callMethod('setActive', 'c')
      await issuePage.waitFor(240)
      const switchedToCRuntime = await issuePage.callMethod('_runE2E')
      expect(switchedToCRuntime?.ok).toBe(true)
      expect(switchedToCRuntime?.active).toBe('c')
      expect(await issuePage.data('active')).toBe('c')
      expect(await issuePage.data('__wv_cls_0')).toEqual([
        'issue302-item issue302-item-a issue302-item-inactive',
        'issue302-item issue302-item-b issue302-item-inactive',
        'issue302-item issue302-item-c issue302-item-active',
      ])
      expect(await readClassName(issuePage, '.issue302-item-a')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-b')).toContain('issue302-item-inactive')
      expect(await readClassName(issuePage, '.issue302-item-c')).toContain('issue302-item-active')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.active).toBe('c')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #309: triggers onLoad without requiring onPullDownRefresh hook', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-309/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-309 page')
      }
      await issuePage.waitFor(500)

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
      expect(await issuePage.data('loadCount')).toBeGreaterThanOrEqual(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #309: triggers onLoad with created setupLifecycle and no pull-down hook', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-309-created/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-309-created page')
      }
      await issuePage.waitFor(500)

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.loadCount).toBeGreaterThanOrEqual(1)
      expect(await issuePage.data('loadCount')).toBeGreaterThanOrEqual(1)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #312: updates computed object bindings after switching back to initial reference', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-312/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-312/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-312 computed object round trip')
    expect(issuePageWxml).toContain('issue312-btn-inc')
    expect(issuePageWxml).toContain('issue312-btn-dec')
    expect(issuePageJs).toContain('_runE2E')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-312/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-312 page')
      }
      await issuePage.waitFor(500)

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.index).toBe(0)
      expect(initialRuntime?.label).toBe('选项1')
      expect(await issuePage.data('index')).toBe(0)
      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('data-current-label="选项1"')
      expect(initialWxml).toContain('data-current-index="0"')

      await issuePage.callMethod('inc')
      await issuePage.waitFor(240)
      const afterIncRuntime = await issuePage.callMethod('_runE2E')
      expect(afterIncRuntime?.ok).toBe(true)
      expect(afterIncRuntime?.index).toBe(1)
      expect(afterIncRuntime?.label).toBe('选项2')
      expect(await issuePage.data('index')).toBe(1)
      const incWxml = await readPageWxml(issuePage)
      expect(incWxml).toContain('data-current-label="选项2"')
      expect(incWxml).toContain('data-current-index="1"')

      await issuePage.callMethod('dec')
      await issuePage.waitFor(240)
      const afterDecRuntime = await issuePage.callMethod('_runE2E')
      expect(afterDecRuntime?.ok).toBe(true)
      expect(afterDecRuntime?.index).toBe(0)
      expect(afterDecRuntime?.label).toBe('选项1')
      expect(await issuePage.data('index')).toBe(0)
      const finalWxml = await readPageWxml(issuePage)
      expect(finalWxml).toContain('data-current-label="选项1"')
      expect(finalWxml).toContain('data-current-index="0"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #316: triggers kebab-case component event bindings at runtime', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-316/index.wxml')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-316 hyphen event binding')
    expect(issuePageWxml).toContain('bind:overlay-click="__weapp_vite_inline"')
    expect(issuePageWxml).toContain('data-wv-event-detail-overlay-click="1"')
    expect(issuePageWxml).toContain('data-wv-inline-id-overlay-click="__wv_inline_0"')
    expect(issuePageWxml).not.toContain('bindoverlay-click=')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-316/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-316 page')
      }
      await issuePage.waitFor(500)

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.overlayClickCount).toBe(0)
      expect(await issuePage.data('overlayClickCount')).toBe(0)

      const emitterHost = await issuePage.$('.issue316-emitter-host')
      if (!emitterHost) {
        throw new Error('Failed to find issue-316 emitter host')
      }
      await emitterHost.dispatchEvent({ eventName: 'overlay-click' })
      await issuePage.waitFor(240)

      const afterTapRuntime = await issuePage.callMethod('_runE2E')
      expect(afterTapRuntime?.ok).toBe(true)
      expect(afterTapRuntime?.overlayClickCount).toBe(1)
      expect(await issuePage.data('overlayClickCount')).toBe(1)

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('overlay clicks: 1')
      expect(renderedWxml).toContain('data-overlay-count="1"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #318: keeps template call-expression rendering stable with auto setData.pick', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-318/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-318/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-318 auto setData pick from template')
    expect(issuePageWxml).toContain('wx:for="{{list}}"')
    expect(issuePageWxml).toContain('data-line="{{__wv_bind_')
    expect(issuePageWxml).toContain('data-meta="{{__wv_bind_')
    expect(issuePageWxml).toContain('{{__wv_bind_')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('pick')
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]count['"`]/)
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]list['"`]/)
    expect(issuePageJs).toMatch(/pick:\[[^\]]*['"`]__wv_bind_\d+['"`]/)

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-318/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-318 page')
      }
      await issuePage.waitFor(500)

      const initialRuntime = await issuePage.callMethod('_runE2E')
      expect(initialRuntime?.ok).toBe(true)
      expect(initialRuntime?.count).toBe(1)
      expect(initialRuntime?.active).toBe('row-0:Alpha')
      expect(initialRuntime?.rows).toEqual([
        'row-0:Alpha',
        'row-1:Beta',
      ])
      expect(initialRuntime?.meta).toBe('meta-1-2')
      expect(await issuePage.data('count')).toBe(1)
      expect((await issuePage.data('list'))?.length).toBe(2)

      await issuePage.callMethod('incCount')
      await issuePage.waitFor(220)
      await issuePage.callMethod('appendRow')
      await issuePage.waitFor(220)
      await issuePage.callMethod('cycleActive')
      await issuePage.waitFor(220)

      const updatedRuntime = await issuePage.callMethod('_runE2E')
      expect(updatedRuntime?.ok).toBe(true)
      expect(updatedRuntime?.count).toBe(2)
      expect(updatedRuntime?.active).toBe('row-1:Beta')
      expect(updatedRuntime?.rows).toEqual([
        'row-0:Alpha',
        'row-1:Beta',
        'row-2:Extra-2',
      ])
      expect(updatedRuntime?.meta).toBe('meta-2-3')
      expect(await issuePage.data('count')).toBe(2)
      expect((await issuePage.data('list'))?.length).toBe(3)

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('count: 2')
      expect(renderedWxml).toContain('size: 3')
      expect(renderedWxml).toContain('active: row-1:Beta')
      expect(renderedWxml).toContain('row-2:Extra-2')
      expect(renderedWxml).toContain('meta-2-3')
      expect(renderedWxml).toContain('data-count="2"')
      expect(renderedWxml).toContain('data-size="3"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #320: supports addRoute name override with alias and redirect replacement', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-320/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-320/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-320 router override + alias + redirect')
    expect(issuePageWxml).toContain('ready for runtime e2e')
    expect(issuePageJs).toContain('_runE2E')
    expect(issuePageJs).toContain('runRedirectNavigationE2E')
    expect(issuePageJs).toContain('issue320-legacy')
    expect(issuePageJs).toContain('/pages/issue-320/new-alias')
    expect(issuePageJs).toContain('/pages/issue-309/index?from=issue320-override')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-320/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-320 page')
      }
      await issuePage.waitFor(500)

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.beforePath).toBe('/pages/issue-320/legacy')
      expect(runtimeResult?.overriddenPath).toBe('/pages/issue-320/new')
      expect(runtimeResult?.newAliasName).toBe('issue320-legacy')
      expect(runtimeResult?.oldAliasName).toBe('')
      expect(runtimeResult?.matchedAliasPath).toBe('/pages/issue-320/new-alias')
      expect(runtimeResult?.redirect).toBe('/pages/issue-309/index?from=issue320-override')
      expect(runtimeResult?.alias).toBe('/pages/issue-320/new-alias')
      expect(runtimeResult?.hasLegacyRoute).toBe(true)

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toContain('data-ok="yes"')
      expect(renderedWxml).toContain('data-before-path="/pages/issue-320/legacy"')
      expect(renderedWxml).toContain('data-overridden-path="/pages/issue-320/new"')
      expect(renderedWxml).toContain('data-new-alias-name="issue320-legacy"')
      expect(renderedWxml).toContain('data-old-alias-name=""')
      expect(renderedWxml).toContain('data-matched-alias-path="/pages/issue-320/new-alias"')
      expect(renderedWxml).toContain('data-redirect="/pages/issue-309/index?from=issue320-override"')
      expect(renderedWxml).toContain('data-alias="/pages/issue-320/new-alias"')
      expect(renderedWxml).toContain('data-has-legacy-route="yes"')

      const navigationResult = await issuePage.callMethod('runRedirectNavigationE2E')
      expect(navigationResult?.ok).toBe(true)

      const redirectedPage = await waitForCurrentPagePath(miniProgram, '/pages/issue-309/index')
      if (!redirectedPage) {
        throw new Error('Failed to wait issue-320 redirect target page')
      }
      // redirectTo 导航后 automator 的 wxml() 快照可能不含文本节点，
      // 改用 callMethod 验证目标页面已正确加载并执行 onLoad。
      await redirectedPage.waitFor(600)
      const freshPage = await miniProgram.currentPage()
      const targetPage = freshPage ?? redirectedPage
      const issue309Runtime = await targetPage.callMethod('_runE2E')
      expect(issue309Runtime?.ok).toBe(true)
      expect(issue309Runtime?.loadCount).toBeGreaterThan(0)
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #317: loads duplicated shared chunks with localized runtime inside subpackages', async () => {
    const itemSharedPath = path.join(DIST_ROOT, 'subpackages/item/weapp-shared/common.js')
    const userSharedPath = path.join(DIST_ROOT, 'subpackages/user/weapp-shared/common.js')
    const itemRuntimePath = path.join(DIST_ROOT, 'subpackages/item/rolldown-runtime.js')
    const userRuntimePath = path.join(DIST_ROOT, 'subpackages/user/rolldown-runtime.js')

    const itemShared = await fs.readFile(itemSharedPath, 'utf-8')
    const userShared = await fs.readFile(userSharedPath, 'utf-8')

    expect(itemShared).toMatch(/require\((['"`])\.\.\/rolldown-runtime\.js\1\)/)
    expect(userShared).toMatch(/require\((['"`])\.\.\/rolldown-runtime\.js\1\)/)
    expect(itemShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(userShared).toMatch(/require\((['"`])\.\.\/\.\.\/\.\.\/common\.js\1\)/)
    expect(await fs.pathExists(itemRuntimePath)).toBe(true)
    expect(await fs.pathExists(userRuntimePath)).toBe(true)

    const miniProgram = await getSharedMiniProgram()

    try {
      const itemPage = await miniProgram.reLaunch('/subpackages/item/index')
      if (!itemPage) {
        throw new Error('Failed to launch issue-317 item subpackage page')
      }
      await itemPage.waitFor(500)
      expect(itemPage).toBeTruthy()

      const userPage = await miniProgram.reLaunch('/subpackages/user/index')
      if (!userPage) {
        throw new Error('Failed to launch issue-317 user subpackage page')
      }
      await userPage.waitFor(500)
      expect(userPage).toBeTruthy()
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #322: keeps static class and hidden v-show state on first render before errors object exists', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-322/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-322/index.js')
    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-322 class/v-show first paint flicker')
    expect(issuePageWxml).toMatch(/class="\{\{__wv_cls_\d+\}\}"/)
    expect(issuePageWxml).toMatch(/style="\{\{__wv_style_\d+\}\}"/)
    expect(issuePageJs).toMatch(/return["'`]issue322-input issue322-input-base["'`]/)
    expect(issuePageJs).toMatch(/return["'`]display: none["'`]/)

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-322/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-322 page')
      }
      await issuePage.waitFor(500)
      const resetResult = await issuePage.callMethod('_resetE2E')
      expect(resetResult?.ok).toBe(true)
      expect(resetResult?.hasEmailError).toBe(false)
      await issuePage.waitFor(260)

      const initialWxml = await readPageWxml(issuePage)
      expect(initialWxml).toContain('state: none')
      expect(await issuePage.data('__wv_cls_0')).toBe('issue322-input issue322-input-base')
      expect(await issuePage.data('__wv_style_0')).toBe('display: none')
      expect(await readClassName(issuePage, '.issue322-input')).toContain('issue322-input-base')
      expect(await readClassName(issuePage, '.issue322-input')).not.toContain('issue322-input-error')

      await tapElement(issuePage, '.issue322-btn-set')
      await issuePage.waitFor(260)
      const setResult = await issuePage.callMethod('_runE2E')
      expect(setResult?.ok).toBe(true)
      expect(setResult?.hasEmailError).toBe(true)
      expect(setResult?.emailError).toBe('invalid email')
      expect(await issuePage.data('__wv_cls_0')).toContain('issue322-input-error')
      expect(await issuePage.data('__wv_style_0')).toBe('')
      expect(await readClassName(issuePage, '.issue322-input')).toContain('issue322-input-error')

      await tapElement(issuePage, '.issue322-btn-clear')
      await issuePage.waitFor(260)
      const clearResult = await issuePage.callMethod('_runE2E')
      expect(clearResult?.ok).toBe(true)
      expect(clearResult?.hasEmailError).toBe(false)
      expect(await issuePage.data('__wv_cls_0')).toBe('issue322-input issue322-input-base')
      expect(await issuePage.data('__wv_style_0')).toBe('display: none')
      expect(await readClassName(issuePage, '.issue322-input')).toContain('issue322-input-base')
      expect(await readClassName(issuePage, '.issue322-input')).not.toContain('issue322-input-error')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #300: renders destructured boolean props in runtime call-expression bindings', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-300/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-300/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-300/PropsDestructureProbe/index.js')
    const strictProbeWxmlPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.wxml')
    const strictProbeJsPath = path.join(DIST_ROOT, 'components/issue-300/StrictNoPropsVarProbe/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')
    const strictProbeWxml = await fs.readFile(strictProbeWxmlPath, 'utf-8')
    const strictProbeJs = await fs.readFile(strictProbeJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-300 props destructure boolean binding')
    expect(issuePageWxml).toContain('toggle str:')
    expect(issuePageWxml).toContain('sync toggle props in place')
    expect(issuePageWxml).toContain('strict-no-props-var')
    expect(issuePageJs).toContain('toggleBool')
    expect(issuePageJs).toContain('toggleStr')
    expect(issuePageJs).toContain('syncTogglePropsInPlace')
    expect(issuePageJs).toContain('_resetE2E')
    expect(issuePageJs).toContain('_runE2E')
    expect(probeWxml).toContain('{{__wv_bind_0}}')
    expect(probeWxml).toContain('{{__wv_bind_1}}')
    expect(probeJs).toContain('__wevuProps.bool')
    expect(probeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(probeJs).not.toContain('__wevuProps.props')
    expect(strictProbeWxml).toContain('{{__wv_bind_0}}')
    expect(strictProbeJs).toContain('__wevuProps.bool')
    expect(strictProbeJs).toContain('Object.prototype.hasOwnProperty.call(this.$state,`bool`)')
    expect(strictProbeJs).not.toContain('__wevuProps.props')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-300/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-300 page')
      }
      await issuePage.waitFor(500)
      const resetResult = await issuePage.callMethod('_resetE2E')
      expect(resetResult?.ok).toBe(true)
      await issuePage.waitFor(300)

      const initialRenderedWxml = await readPageWxml(issuePage)
      expect(initialRenderedWxml).toContain('toggle bool: true')
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'primitive', boolText: 'true', strText: 'Hello' })
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'ref-object', boolText: 'true', strText: 'RefHello' })
      expectPropsProbeCase(initialRenderedWxml, { caseId: 'reactive-object', boolText: 'true', strText: 'ReactiveHello' })
      expect(initialRenderedWxml).not.toContain('data-strict-bool="undefined"')

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.str).toBe('Hello')
      expect(runtimeResult?.bool).toBe(true)
      expect(runtimeResult?.boolText).toBe('true')
      expect(runtimeResult?.refObjectStr).toBe('RefHello')
      expect(runtimeResult?.refObjectBool).toBe(true)
      expect(runtimeResult?.reactiveObjectStr).toBe('ReactiveHello')
      expect(runtimeResult?.reactiveObjectBool).toBe(true)

      await tapElement(issuePage, '.issue300-toggle-bool')

      const toggledBoolWxml = await readPageWxml(issuePage)
      expect(toggledBoolWxml).toContain('toggle bool: false')
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'primitive', boolText: 'false', strText: 'Hello' })
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'ref-object', boolText: 'false', strText: 'RefHello' })
      expectPropsProbeCase(toggledBoolWxml, { caseId: 'reactive-object', boolText: 'false', strText: 'ReactiveHello' })
      expect(toggledBoolWxml).not.toContain('data-strict-bool="undefined"')

      await tapElement(issuePage, '.issue300-toggle-str')

      const toggledStrWxml = await readPageWxml(issuePage)
      expect(toggledStrWxml).toContain('toggle str: World')
      expectPropsProbeCase(toggledStrWxml, { caseId: 'primitive', boolText: 'false', strText: 'World' })
      expectPropsProbeCase(toggledStrWxml, { caseId: 'ref-object', boolText: 'false', strText: 'RefWorld' })
      expectPropsProbeCase(toggledStrWxml, { caseId: 'reactive-object', boolText: 'false', strText: 'ReactiveWorld' })
      expect(toggledStrWxml).not.toContain('data-strict-bool="undefined"')

      await tapElement(issuePage, '.issue300-toggle-sync')

      const syncedWxml = await readPageWxml(issuePage)
      expect(syncedWxml).toContain('toggle bool: true')
      expect(syncedWxml).toContain('toggle str: Hello')
      expectPropsProbeCase(syncedWxml, { caseId: 'primitive', boolText: 'true', strText: 'Hello' })
      expectPropsProbeCase(syncedWxml, { caseId: 'ref-object', boolText: 'true', strText: 'RefHello' })
      expectPropsProbeCase(syncedWxml, { caseId: 'reactive-object', boolText: 'true', strText: 'ReactiveHello' })
      expect(syncedWxml).not.toContain('data-strict-bool="undefined"')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })

  it('issue #328: keeps setup ref string props out of null/default fallback on first paint', async () => {
    const issuePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-328/index.wxml')
    const issuePageJsPath = path.join(DIST_ROOT, 'pages/issue-328/index.js')
    const probeWxmlPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.wxml')
    const probeJsPath = path.join(DIST_ROOT, 'components/issue-328/ValueProbe/index.js')

    const issuePageWxml = await fs.readFile(issuePageWxmlPath, 'utf-8')
    const issuePageJs = await fs.readFile(issuePageJsPath, 'utf-8')
    const probeWxml = await fs.readFile(probeWxmlPath, 'utf-8')
    const probeJs = await fs.readFile(probeJsPath, 'utf-8')

    expect(issuePageWxml).toContain('issue-328 setup ref prop first paint')
    expect(issuePageWxml).toContain('value="{{value1}}"')
    expect(issuePageJs).toContain('value1')
    expect(issuePageJs).toContain('_runE2E')
    expect(probeWxml).toContain('data-current-value="{{props.value}}"')
    expect(probeWxml).toContain('data-history="{{historyText}}"')
    expect(probeJs).toContain('valueHistory')
    expect(probeJs).toContain('historyText')

    const miniProgram = await getSharedMiniProgram()

    try {
      const issuePage = await miniProgram.reLaunch('/pages/issue-328/index')
      if (!issuePage) {
        throw new Error('Failed to launch issue-328 page')
      }
      await issuePage.waitFor(400)

      const runtimeResult = await issuePage.callMethod('_runE2E')
      expect(runtimeResult?.ok).toBe(true)
      expect(runtimeResult?.value1).toBe('111')

      const renderedWxml = await readPageWxml(issuePage)
      expect(renderedWxml).toMatch(/data-current-value="111"/)
      expect(renderedWxml).toMatch(/data-history="111"/)
      expect(renderedWxml).not.toContain('data-history="null')
      expect(renderedWxml).not.toContain('data-history="0.00')
      expect(renderedWxml).not.toContain('data-history="undefined')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
