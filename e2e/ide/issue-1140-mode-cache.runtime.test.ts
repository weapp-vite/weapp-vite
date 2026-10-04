import type { SequenceInput } from '../../scripts/editSequence/driver'
import type { DomCheckpoint } from '../utils/domAcceptance/types'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { verifyEditSequence } from '../../scripts/editSequence/driver'
import { createSequenceProject } from '../../scripts/editSequence/project'
import { WeappModeSequenceSession } from '../../scripts/editSequence/weappModes'
import { createWeappModeSequence } from '../../scripts/editSequence/weappModeScenarios'
import { launchAutomator } from '../utils/automator'
import { createDomAcceptance } from '../utils/domAcceptance'
import { createProductionRuntime } from '../utils/productionRuntime'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'

const homeRoute = '/pages/home/index'

async function releaseResources(operations: Array<() => Promise<unknown>>, failures: unknown[] = []) {
  for (const operation of operations) {
    try {
      await operation()
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError(failures, 'Mode/cache runtime resources did not close cleanly')
  }
}

function expectedValue(step: number) {
  return step >= 6 ? 'inline-after-removal' : step >= 2 ? 'changed-main' : 'main-shared'
}

function checkpoints(): DomCheckpoint[] {
  return Array.from({ length: 8 }, (_, step) => [
    {
      id: `home-${step}`,
      route: homeRoute,
      action: `检查第 ${step} 步模式与缓存变更后的主页面及组件`,
      nodes: [
        { selector: '#mode-value', text: expectedValue(step) },
        { selector: '#mode-card', ...(step < 4 ? { text: 'shared-card' } : { count: 0 }) },
      ],
    },
    ...(step < 6
      ? [{
          id: `subpackage-${step}`,
          route: `/${step >= 5 ? 'package-b' : 'package-a'}/pages/detail/index`,
          action: '检查分包移动前后的真实导航和共享模块',
          nodes: [{ selector: '#mode-value', text: 'subpackage-shared' }],
        }]
      : []),
  ]).flat()
}

describe.each([true, false])('issue #1140 production runtime after mode/cache transitions (emptyOutDir=%s)', (emptyOutDir) => {
  let suiteFixture: Awaited<ReturnType<typeof createSequenceProject>> | undefined
  let suiteSession: WeappModeSequenceSession | undefined
  let runtime: ReturnType<typeof createProductionRuntime<Awaited<ReturnType<typeof launchAutomator>>>> | undefined
  let closing = false
  let cleanup: Promise<void> | undefined
  const pending = new Set<Promise<unknown>>()

  function assertActive(input: SequenceInput) {
    input.signal.throwIfAborted()
    if (closing) {
      throw new Error('Mode/cache runtime suite is closing')
    }
  }

  async function track<T>(input: SequenceInput, operation: () => Promise<T>) {
    assertActive(input)
    const task = operation()
    pending.add(task)
    try {
      return await task
    }
    finally {
      pending.delete(task)
    }
  }

  async function closeHost() {
    await runtime?.close()
  }

  function closeResources() {
    cleanup ??= (async () => {
      closing = true
      // driver 的超时只停止等待；先接住晚到的连接/构建结果，再释放它们使用的目录。
      const settled = await Promise.allSettled([...pending])
      const failures = settled.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
      await releaseResources([closeHost, async () => suiteSession?.close(), async () => suiteFixture?.close()], failures)
    })()
    return cleanup
  }

  async function getRuntime(input: SequenceInput) {
    assertActive(input)
    const host = await runtime!.open()
    // 超时期间返回的 host 仍先登记，cleanup 等待本任务结束后统一关闭。
    assertActive(input)
    return host
  }

  function launchProductionRuntime(options: { projectPath: string, cliPath?: string }) {
    return launchAutomator({ ...options, bridgeProjectMode: 'direct', warmupRoute: homeRoute, warmupRootSelectors: ['#mode-value'] })
  }

  // 本场景每步是全量 production，允许重新装载独占项目；不是保存状态的 HMR，也不重启共享宿主。
  // DevTools 的 reLaunch/普通编译仍可能读取旧代模块，必须和 headless 清除 VM 缓存保持同一边界。
  // 同一代的页面/分包导航复用一个连接；driver 与 Vitest 兜底共用幂等清理。
  afterAll(closeResources, 300_000)

  it('renders every production result and matches a fresh build in a separate directory', async (context) => {
    const fixture = await createSequenceProject()
    suiteFixture = fixture
    const project = path.join(fixture.root, 'incremental')
    const session = new WeappModeSequenceSession(project, false)
    suiteSession = session
    runtime = createProductionRuntime({ projectPath: project, provider: resolveRuntimeProviderName(), launch: launchProductionRuntime })

    try {
      const sequence = createWeappModeSequence(emptyOutDir)
      const dom = createDomAcceptance(context, 'scripts/editSequence/weappModeScenarios.ts', checkpoints())

      async function observeRuntime(input: SequenceInput) {
        const host = await getRuntime(input)
        assertActive(input)
        const page = await host.reLaunch(homeRoute)
        assertActive(input)
        await dom.check(`home-${input.step}`, host, page)
        const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[], subPackages?: Array<{ root: string }> }
        if (input.step < 6) {
          const root = input.step >= 5 ? 'package-b' : 'package-a'
          expect(app.subPackages?.map(item => item.root)).toEqual([root])
          assertActive(input)
          const subpage = await host.reLaunch(`/${root}/pages/detail/index`)
          assertActive(input)
          await dom.check(`subpackage-${input.step}`, host, subpage)
        }
        else {
          expect(app.pages).toEqual(['pages/home/index'])
          expect(app.subPackages ?? []).toEqual([])
        }
      }

      await verifyEditSequence(sequence, {
        name: `production-runtime-${resolveRuntimeProviderName()}`,
        incremental: input => track(input, async () => {
          // 先关闭上一代拥有的项目，再修改磁盘，避免 IDE 同时热加载中间的 dev/prod 输出。
          await closeHost()
          assertActive(input)
          return session.observe(input)
        }),
        fresh: input => track(input, async () => {
          const root = path.join(fixture.root, `fresh-${input.step}`)
          await mkdir(root, { recursive: true })
          const fresh = new WeappModeSequenceSession(root, true)
          let outputs: Awaited<ReturnType<typeof fresh.observe>> | undefined
          let failure: { error: unknown } | undefined
          try {
            assertActive(input)
            outputs = await fresh.observe(input)
          }
          catch (error) {
            failure = { error }
          }
          try {
            await releaseResources([() => fresh.close(), () => rm(root, { recursive: true, force: true })])
          }
          catch (cleanupError) {
            if (failure) {
              throw new AggregateError([failure.error, cleanupError], 'Fresh build and resource cleanup both failed')
            }
            throw cleanupError
          }
          if (failure) {
            throw failure.error
          }
          return outputs!
        }),
        afterCompare: input => track(input, () => observeRuntime(input)),
        close: closeResources,
      }, { timeoutMs: 300_000 })
    }
    catch (error) {
      if (!cleanup) {
        try {
          await closeResources()
        }
        catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Mode/cache verification and cleanup both failed')
        }
      }
      throw error
    }
    finally {
      if (!cleanup) {
        await closeResources()
      }
    }
  }, 600_000)
})
