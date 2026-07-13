import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/react-runtime-spike')

let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | undefined

describe.sequential('react runtime spike (weapp e2e)', () => {
  afterAll(async () => {
    await miniProgram?.close()
    miniProgram = undefined
  })

  it('renders React hooks and dispatches host events through generic WXML', async () => {
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
    })
    const page = await miniProgram.currentPage()
    if (!page) {
      throw new Error('Failed to launch React runtime spike page')
    }

    const result = await miniProgram.evaluate(() => {
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
})
