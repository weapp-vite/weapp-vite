import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import {
  createTemplateWevuTdesignRegressionLaunchOptions,
  relaunchTemplateWevuTdesignRegressionPage,
} from './template-wevu-tdesign-regression.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const TEMPLATE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/template-wevu-tdesign-regression')
const DIST_ROOT = path.join(TEMPLATE_ROOT, 'dist')
const ROUTE = '/subpackages/lab/class-binding/index'

interface BindingProbeNode {
  'class'?: string
  'background-color'?: string
  'border-color'?: string
  'border-radius'?: string
  'border-style'?: string
  'color'?: string
  'font-size'?: string
  'height'?: number
  'letter-spacing'?: string
  'opacity'?: string
  'style'?: string
  'width'?: number
}

interface BindingSnapshot {
  bindings?: Record<string, string>
  missing: string[]
  nodes: Record<string, BindingProbeNode | null>
  state: Record<string, any>
}

const BLUE_RE = /(?:rgb\(37,\s*99,\s*235\)|#2563eb)/i
const RED_RE = /(?:rgb\(185,\s*28,\s*28\)|#b91c1c)/i
const WHITE_RE = /(?:rgb\(255,\s*255,\s*255\)|#fff(?:fff)?)/i

function readStyle(snapshot: BindingSnapshot, key: string, styleName: keyof BindingProbeNode) {
  return String(snapshot.nodes[key]?.[styleName] ?? '').trim()
}

function readNodeProperty(snapshot: BindingSnapshot, key: string, propertyName: 'class' | 'style') {
  return String(snapshot.nodes[key]?.[propertyName] ?? '').trim()
}

function readBinding(snapshot: BindingSnapshot, key: string) {
  return String(snapshot.bindings?.[key] ?? '').trim()
}

function normalizeInlineStyle(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function expectClassTokens(snapshot: BindingSnapshot, key: string, tokens: string[]) {
  const className = readBinding(snapshot, key) || readNodeProperty(snapshot, key, 'class')
  for (const token of tokens) {
    expect(className.split(/\s+/), `${key} class="${className}"`).toContain(token)
  }
}

function expectInlineStyleContains(snapshot: BindingSnapshot, key: string, fragment: string) {
  const style = normalizeInlineStyle(readBinding(snapshot, key) || readNodeProperty(snapshot, key, 'style'))
  expect(style, `${key} style`).toContain(normalizeInlineStyle(fragment))
}

function readInlineStyleValue(snapshot: BindingSnapshot, key: string, propertyName: string) {
  const style = normalizeInlineStyle(readBinding(snapshot, key) || readNodeProperty(snapshot, key, 'style'))
  const match = style.match(new RegExp(`${propertyName}:([^;]+)`))
  expect(match, `${key} ${propertyName} in style="${style}"`).toBeTruthy()
  return match![1]
}

function readInlineCssSizePx(snapshot: BindingSnapshot, key: string, propertyName: string) {
  const value = readInlineStyleValue(snapshot, key, propertyName)
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px|rpx)$/)
  expect(match, `invalid ${propertyName} for ${key}: ${value}`).toBeTruthy()
  const size = Number(match![1])
  return match![2] === 'rpx' ? size / 2 : size
}

function expectApproxCssSizePx(actual: number, expected: number) {
  expect(actual).toBeGreaterThanOrEqual(expected - 1)
  expect(actual).toBeLessThanOrEqual(expected + 1)
}

function expectRenderedNode(snapshot: BindingSnapshot, key: string) {
  const node = snapshot.nodes[key]
  expect(node, `missing rendered node: ${key}`).toBeTruthy()
  expect(Number(node?.width ?? 0), `invalid rendered width: ${key}`).toBeGreaterThan(0)
  expect(Number(node?.height ?? 0), `invalid rendered height: ${key}`).toBeGreaterThan(0)
  return node!
}

async function collectSnapshot(page: any) {
  const snapshot = await page.callMethod('collectClassBindingSnapshot') as BindingSnapshot
  expect(snapshot.missing).toEqual([])
  for (const key of Object.keys(snapshot.nodes)) {
    expectRenderedNode(snapshot, key)
  }
  return snapshot
}

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: TEMPLATE_ROOT,
    platform: 'weapp',
    cwd: TEMPLATE_ROOT,
    label: 'ide:template-wevu-tdesign-regression-class-style-bindings',
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
    sharedMiniProgram = await launchAutomator(createTemplateWevuTdesignRegressionLaunchOptions(TEMPLATE_ROOT))
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

describe.sequential('e2e app: template-wevu-tdesign-regression class/style binding lab', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('covers class/style binding branches with interactive scenarios', async (ctx) => {
    const miniProgram = await getSharedMiniProgram()

    try {
      const page = await relaunchTemplateWevuTdesignRegressionPage(ctx, miniProgram, ROUTE, 'class/style binding')
      await page.waitFor(160)

      await page.callMethod('applyScenarioBase')
      await page.waitFor(120)
      let snapshot = await collectSnapshot(page)
      expect(snapshot.state).toMatchObject({
        classObject: {
          'demo-active': false,
          'demo-ghost': false,
          'demo-round': false,
          'text-danger': false,
        },
        hasError: false,
        isActive: false,
        isGhost: false,
        isRound: false,
      })
      expect(readStyle(snapshot, 'class-object', 'color')).not.toMatch(RED_RE)
      expect(readStyle(snapshot, 'class-array', 'color')).not.toMatch(RED_RE)
      expect(readStyle(snapshot, 'style-object', 'border-style')).toBe('solid')
      expect(readStyle(snapshot, 'style-object', 'border-radius')).toMatch(/^(?:18rpx|9px)$/)
      expectInlineStyleContains(snapshot, 'styleArray', 'opacity:1')
      const baseFontSizePx = readInlineCssSizePx(snapshot, 'styleString', 'font-size')
      expectApproxCssSizePx(baseFontSizePx, 12)
      expect(readStyle(snapshot, 'style-var', 'color')).toMatch(BLUE_RE)

      await page.callMethod('applyScenarioAllOn')
      await page.waitFor(120)
      snapshot = await collectSnapshot(page)
      expect(snapshot.state).toMatchObject({
        classObject: {
          'demo-active': true,
          'demo-ghost': true,
          'demo-round': true,
          'text-danger': true,
        },
        hasError: true,
        isActive: true,
        isGhost: true,
        isRound: true,
      })
      expectClassTokens(snapshot, 'classStaticObject', ['demo-active', 'text-danger'])
      expect(readStyle(snapshot, 'class-reactive', 'border-style')).toBe('dashed')
      expectClassTokens(snapshot, 'classArray', ['demo-active', 'text-danger', 'demo-round'])
      expect(readStyle(snapshot, 'class-array-key', 'border-style')).toBe('dashed')
      expect(readStyle(snapshot, 'style-object', 'border-style')).toBe('dashed')
      expectInlineStyleContains(snapshot, 'styleObject', 'color:#b91c1c')
      expectInlineStyleContains(snapshot, 'styleArray', 'opacity:0.78')
      const activeFontSizePx = readInlineCssSizePx(snapshot, 'styleString', 'font-size')
      expectApproxCssSizePx(activeFontSizePx, 13)
      expect(activeFontSizePx).toBeGreaterThan(baseFontSizePx)
      expectInlineStyleContains(snapshot, 'styleString', 'color:#b91c1c')

      await page.callMethod('applyScenarioMixed')
      await page.waitFor(120)
      snapshot = await collectSnapshot(page)
      expect(snapshot.state).toMatchObject({
        hasError: false,
        isActive: true,
        isGhost: false,
        isRound: true,
      })
      expect(readStyle(snapshot, 'class-cond-array', 'color')).toMatch(WHITE_RE)
      expect(readStyle(snapshot, 'class-cond-array', 'color')).not.toMatch(RED_RE)
      expect(readStyle(snapshot, 'style-var', 'color')).toMatch(BLUE_RE)

      await page.callMethod('applyScenarioErrorGhost')
      await page.waitFor(120)
      snapshot = await collectSnapshot(page)
      expect(snapshot.state).toMatchObject({
        isActive: false,
        hasError: true,
        isRound: false,
        isGhost: true,
      })
      expect(readStyle(snapshot, 'class-array-key', 'color')).toMatch(RED_RE)
      expect(readStyle(snapshot, 'class-array-key', 'border-style')).toBe('dashed')
      expect(readStyle(snapshot, 'style-var', 'color')).toMatch(/(?:rgb\(239,\s*68,\s*68\)|#ef4444)/i)
      expect(snapshot.state.errorClassIf).toBe('text-danger')
      expect(snapshot.state.ghostClassIf).toBe('demo-ghost')
    }
    finally {
      await releaseSharedMiniProgram(miniProgram)
    }
  })
})
