import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/react-runtime-spike')

let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined
const runtimeProvider = resolveRuntimeProviderName()

function getMiniProgram() {
  if (!miniProgram) {
    throw new Error('React runtime spike automator is not initialized')
  }
  return miniProgram
}

describe.sequential('react runtime spike (weapp e2e)', () => {
  beforeAll(async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: CLI_PATH,
      projectRoot: APP_ROOT,
      platform: 'weapp',
      cwd: APP_ROOT,
      label: 'ide:react-runtime-spike',
      skipNpm: true,
    })

    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipRelaunchPageRootCheck: true,
    })
  }, 180_000)

  afterAll(async () => {
    await miniProgram?.close()
    miniProgram = undefined
  })

  it.runIf(runtimeProvider === 'devtools')('renders React hooks and dispatches host events through generic WXML', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/index/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React runtime spike page')
    }

    const result = await app.evaluate(() => {
      return new Promise((resolve) => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const currentPage = pages[pages.length - 1] as any
        const findNode = (nodes: any[], predicate: (node: any) => boolean): any => {
          for (const node of nodes ?? []) {
            if (predicate(node)) {
              return node
            }
            const nested = findNode(node.cn, predicate)
            if (nested) {
              return nested
            }
          }
          return undefined
        }
        const readText = (id: string) => {
          const node = findNode(currentPage.data.root.cn, candidate => candidate.p?.id === id)
          return node?.cn?.map((child: any) => child.v ?? '').join('') ?? ''
        }
        const dispatch = (id: string) => {
          const node = findNode(currentPage.data.root.cn, candidate => candidate.p?.id === id)
          currentPage.eh({
            currentTarget: {
              dataset: {
                sid: node.sid,
              },
            },
            type: 'tap',
          })
        }

        const initialCount = readText('count')
        dispatch('increment')
        dispatch('append')

        setTimeout(() => {
          const query = wx.createSelectorQuery().in(currentPage)
          query.select('#count').boundingClientRect((rect) => {
            resolve({
              countAfterTap: readText('count'),
              countRect: rect,
              initialCount,
              itemCount: currentPage.data.root.cn
                ? (() => {
                    let count = 0
                    const visit = (nodes: any[]) => {
                      for (const node of nodes ?? []) {
                        if (node.cl === 'item') {
                          count += 1
                        }
                        visit(node.cn)
                      }
                    }
                    visit(currentPage.data.root.cn)
                    return count
                  })()
                : 0,
            })
          }).exec()
        }, 120)
      })
    }) as Record<string, any>

    expect(result.initialCount).toContain('count:0 doubled:0')
    expect(result.countAfterTap).toContain('count:1 doubled:2')
    expect(result.itemCount).toBe(3)
    expect(Number(result.countRect?.width ?? 0)).toBeGreaterThan(0)
  })

  it.runIf(runtimeProvider === 'devtools')('renders the compiled native WXML page with binding-only payloads', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/static/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React static binding spike page')
    }

    const initialCount = await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      const originalSetData = currentPage.setData
      currentPage.__reactStaticPayloads = []
      currentPage.setData = function (payload: Record<string, unknown>, callback?: () => void) {
        currentPage.__reactStaticPayloads.push(payload)
        return originalSetData.call(currentPage, payload, callback)
      }
      return currentPage.data.slots.s3.text
    })

    await app.evaluate(() => {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const currentPage = pages[pages.length - 1] as any
      currentPage.eh({
        currentTarget: {
          dataset: {
            sid: 's4',
          },
        },
        type: 'tap',
      })
    })
    await page.waitFor(160)

    const result = await app.evaluate(() => {
      return new Promise((resolve) => {
        const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
        const currentPage = pages[pages.length - 1] as any
        const query = wx.createSelectorQuery().in(currentPage)
        query.select('#count').boundingClientRect((rect) => {
          const payloads = currentPage.__reactStaticPayloads ?? []
          resolve({
            countAfterTap: currentPage.data.slots.s3.text,
            countRect: rect,
            payloadBytes: payloads.map((payload: Record<string, unknown>) => JSON.stringify(payload).length),
            payloads,
          })
        }).exec()
      })
    }) as Record<string, any>

    expect(initialCount).toBe('count:0 doubled:0')
    expect(result.countAfterTap).toBe('count:1 doubled:2')
    expect(result.payloads).toEqual([{ 'slots.s3.text': 'count:1 doubled:2' }])
    expect(result.payloadBytes).toEqual([37])
    expect(Number(result.countRect?.width ?? 0)).toBeGreaterThan(0)
  })

  it('passes props, change events and default slots across all six interop edges', async () => {
    const app = getMiniProgram()
    await app.reLaunch('/pages/interop/index')
    const page = await app.currentPage()
    if (!page) {
      throw new Error('Failed to launch React interop page')
    }

    const result = await page.callMethod('_runInteropE2E') as Record<string, any>

    expect(result.props).toEqual([
      { label: 'react-to-native', value: 1 },
      { label: 'react-to-wevu', value: 2 },
      { label: 'native-to-wevu', value: 3 },
      { label: 'native-to-react', value: 4 },
      { label: 'wevu-to-native', value: 5 },
      { label: 'wevu-to-react', value: 6 },
    ])
    expect(result.reactResults).toEqual(['native:2', 'wevu:3'])
    expect(result.nativeParent).toMatchObject({ reactResult: 'react:5', wevuResult: 'wevu:4' })
    expect(result.wevuParent).toMatchObject({ nativeResult: 'native:6', reactResult: 'react:7' })
    expect(result.slots.map((slot: any) => slot.name)).toEqual([
      'react-to-native',
      'react-to-wevu',
      'native-to-wevu',
      'native-to-react',
      'wevu-to-native',
      'wevu-to-react',
    ])
    for (const slot of result.slots) {
      expect(slot.width).toBeGreaterThan(0)
      expect(slot.height).toBeGreaterThan(0)
    }
  })
})
