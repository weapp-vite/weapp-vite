import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../templates/weapp-vite-wevu-tailwindcss-tdesign-template')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/subpackages/lab/class-binding/index'

function parseClassList(classValue: string | undefined) {
  if (!classValue) {
    return []
  }
  return classValue.split(/\s+/).map(token => token.trim()).filter(Boolean)
}

function getOpenTagByDataE2E(wxml: string, dataE2E: string) {
  const matched = wxml.match(new RegExp(`<view[^>]*data-e2e="${dataE2E}"[^>]*>`, 'm'))
  return matched?.[0] ?? ''
}

function getAttrFromOpenTag(tag: string, attrName: string) {
  const matched = tag.match(new RegExp(`${attrName}="([^"]*)"`, 'm'))
  return matched?.[1] ?? ''
}

function readClassAndStyleByDataE2E(wxml: string, dataE2E: string) {
  const tag = getOpenTagByDataE2E(wxml, dataE2E)
  return {
    classValue: getAttrFromOpenTag(tag, 'class'),
    styleValue: getAttrFromOpenTag(tag, 'style'),
  }
}

function expectClassIncludes(classValue: string, classNames: string[]) {
  const list = parseClassList(classValue)
  for (const className of classNames) {
    expect(list).toContain(className)
  }
}

function expectClassExcludes(classValue: string, classNames: string[]) {
  const list = parseClassList(classValue)
  for (const className of classNames) {
    expect(list).not.toContain(className)
  }
}

async function readPageWxml(page: any) {
  const root = await page.$('page')
  if (!root) {
    throw new Error('Failed to find page root')
  }
  return await root.wxml()
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-class-style-bindings',
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
      projectPath: TEMPLATE_ROOT,
    })
  }
  return sharedMiniProgram
}

async function releaseSharedMiniProgram(miniProgram: any) {
  if (!sharedMiniProgram || sharedMiniProgram === miniProgram) {
    return
  }
  await miniProgram.close()
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close()
}

describe.sequential('template e2e: weapp-vite-wevu-tailwindcss-tdesign-template class/style binding lab', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers class/style binding branches with interactive scenarios', async () => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await miniProgram.reLaunch(ROUTE)
      if (!page) {
        throw new Error(`Failed to launch route: ${ROUTE}`)
      }
      await page.waitFor(160)

      await page.callMethod('applyScenarioBase')
      await page.waitFor(120)
      let wxml = await readPageWxml(page)

      const baseObjectDemo = readClassAndStyleByDataE2E(wxml, 'class-object')
      expectClassExcludes(baseObjectDemo.classValue, ['demo-active', 'text-danger', 'demo-round', 'demo-ghost'])

      const baseArrayDemo = readClassAndStyleByDataE2E(wxml, 'class-array')
      expectClassExcludes(baseArrayDemo.classValue, ['demo-active', 'text-danger', 'demo-round', 'demo-ghost'])

      const baseStyleObject = readClassAndStyleByDataE2E(wxml, 'style-object')
      expect(baseStyleObject.styleValue).toMatch(/border-style:\s*solid/)
      expect(baseStyleObject.styleValue).toMatch(/border-radius:\s*(18rpx|9px)/)
      expect(baseStyleObject.styleValue).not.toMatch(/#ef4444/)

      const baseStyleArray = readClassAndStyleByDataE2E(wxml, 'style-array')
      expect(baseStyleArray.styleValue).toMatch(/transform:\s*translateY\(0(?:rpx|px)\)/)
      expect(baseStyleArray.styleValue).toMatch(/opacity:\s*1/)

      const baseStyleString = readClassAndStyleByDataE2E(wxml, 'style-string')
      expect(baseStyleString.styleValue).toMatch(/font-size:\s*(24rpx|12px)/)
      expect(baseStyleString.styleValue).toMatch(/letter-spacing:\s*(0\.5rpx|0\.25px)/)

      const baseStyleVar = readClassAndStyleByDataE2E(wxml, 'style-var')
      expect(baseStyleVar.styleValue).toContain('--lab-accent:#2563eb')
      expect(baseStyleVar.styleValue).toContain('var(--lab-accent)')

      await page.callMethod('applyScenarioAllOn')
      await page.waitFor(120)
      wxml = await readPageWxml(page)

      const allOnStaticObjectDemo = readClassAndStyleByDataE2E(wxml, 'class-static-object')
      expectClassIncludes(allOnStaticObjectDemo.classValue, ['demo-active', 'text-danger'])

      const allOnReactiveDemo = readClassAndStyleByDataE2E(wxml, 'class-reactive')
      expectClassIncludes(allOnReactiveDemo.classValue, ['demo-active', 'text-danger', 'demo-round', 'demo-ghost'])

      const allOnArrayDemo = readClassAndStyleByDataE2E(wxml, 'class-array')
      expectClassIncludes(allOnArrayDemo.classValue, ['demo-active', 'text-danger', 'demo-round'])

      const allOnArrayKeyDemo = readClassAndStyleByDataE2E(wxml, 'class-array-key')
      expectClassIncludes(allOnArrayKeyDemo.classValue, ['demo-active', 'text-danger', 'demo-ghost'])

      const allOnStyleObject = readClassAndStyleByDataE2E(wxml, 'style-object')
      expect(allOnStyleObject.styleValue).toMatch(/border-style:\s*dashed/)
      expect(allOnStyleObject.styleValue).toMatch(/border-radius:\s*(999rpx|499\.5px)/)
      expect(allOnStyleObject.styleValue).toMatch(/#ef4444/)

      const allOnStyleArray = readClassAndStyleByDataE2E(wxml, 'style-array')
      expect(allOnStyleArray.styleValue).toMatch(/transform:\s*translateY\(-4(?:rpx|px)\)/)
      expect(allOnStyleArray.styleValue).toMatch(/opacity:\s*0\.78/)

      const allOnStyleString = readClassAndStyleByDataE2E(wxml, 'style-string')
      expect(allOnStyleString.styleValue).toMatch(/font-size:\s*(26rpx|13px)/)
      expect(allOnStyleString.styleValue).toMatch(/color:\s*#b91c1c/)
      expect(allOnStyleString.styleValue).toMatch(/letter-spacing:\s*(1\.2rpx|0\.6px)/)

      await page.callMethod('applyScenarioMixed')
      await page.waitFor(120)
      wxml = await readPageWxml(page)

      const mixedCondArrayDemo = readClassAndStyleByDataE2E(wxml, 'class-cond-array')
      expectClassIncludes(mixedCondArrayDemo.classValue, ['demo-active'])
      expectClassExcludes(mixedCondArrayDemo.classValue, ['text-danger'])

      const mixedStyleVar = readClassAndStyleByDataE2E(wxml, 'style-var')
      expect(mixedStyleVar.styleValue).toContain('--lab-accent:#2563eb')

      await page.callMethod('applyScenarioErrorGhost')
      await page.waitFor(120)
      wxml = await readPageWxml(page)

      const errorGhostArrayKeyDemo = readClassAndStyleByDataE2E(wxml, 'class-array-key')
      expectClassIncludes(errorGhostArrayKeyDemo.classValue, ['text-danger', 'demo-ghost'])
      expectClassExcludes(errorGhostArrayKeyDemo.classValue, ['demo-active'])

      const errorGhostStyleVar = readClassAndStyleByDataE2E(wxml, 'style-var')
      expect(errorGhostStyleVar.styleValue).toContain('--lab-accent:#ef4444')

      const state = await page.callMethod('runE2EState')
      expect(state).toMatchObject({
        isActive: false,
        hasError: true,
        isRound: false,
        isGhost: true,
      })
      expect(state.errorClassIf).toBe('text-danger')
      expect(state.ghostClassIf).toBe('demo-ghost')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
