import type { HeadlessPageInstance } from '../src/runtime'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { nativeFormFiles, nativeFormValue } from './helpers/nativeForm'

const tempDirs: string[] = []
const sessions: Array<{ close: () => void | Promise<void> }> = []

function createProject() {
  const projectPath = createBaseFixture()
  tempDirs.push(projectPath)
  for (const [file, source] of nativeFormFiles) {
    const output = path.join(projectPath, 'dist', file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, source)
  }
  return projectPath
}

function setDataAndCommit(page: HeadlessPageInstance, patch: Record<string, unknown>) {
  return new Promise<void>(resolve => page.setData(patch, resolve))
}

afterEach(async () => {
  for (const session of sessions.splice(0)) {
    await session.close()
  }
  cleanupTempDirs(tempDirs)
})

describe.each(['node', 'browser'] as const)('%s native form activation', (provider) => {
  async function createSession() {
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath: createProject() })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeFormFiles) })
    sessions.push(session)
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(session.getApp()!.globalData.stages.at(-1)).toBe('done'))
    const events = session.getApp()!.globalData.events as Array<Record<string, any>>
    const node = (selector: string) => querySelectorAll(session.renderCurrentPage().root, selector)[0]!
    const tap = (selector: string) => session.dispatchNativeNodeEvent(node(selector), 'tap', {})
    const handle = (selector: string) => new HeadlessTestingNodeHandle(node(selector), {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      dispatchNativeEvent: (target, type, event, onHandlerResult) => session.dispatchNativeNodeEvent(target, type, event, onHandlerResult),
      createPageHandle: () => ({ data: async () => page.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
    return { session, page, events, tap, handle }
  }

  it.each(['#submit', '#nested', '#enabled-false'])('submits exactly once after taps for %s with typed participating field values', async (selector) => {
    const { page, events, handle } = await createSession()
    expect(await handle(selector).tap()).toBe('tap-result')
    expect(page.data.taps).toBe(1)
    expect(page.data.submissions).toBe(1)
    expect(events.map(event => [event.type, event.currentTarget])).toEqual([
      ['tap', selector === '#enabled-false' ? 'enabled-false' : 'submit'],
      ['tap', 'raw-form'],
      ['submit', 'raw-form'],
    ])
    expect(events[0]!.target).toBe(selector.slice(1))
    expect(events[2]).toMatchObject({ target: 'raw-form', detail: { value: nativeFormValue } })
    expect(Object.hasOwn(events[2]!.detail.value, '__proto__')).toBe(true)
    expect(events[2]!.detail.value.inner).toBeUndefined()
    expect(events[2]!.detail.value.notAField).toBeUndefined()
  })

  it.each(['#disabled', '#orphan', '#ordinary'])('does not submit for %s while preserving tap dispatch', async (selector) => {
    const { page, events, handle } = await createSession()
    expect(await handle(selector).tap()).toBe('tap-result')
    expect(page.data.taps).toBe(1)
    expect(events.filter(event => event.type === 'submit')).toEqual([])
  })

  it('handles an unbound native submit default without demanding a tap binding', async () => {
    const { handle, events } = await createSession()
    await expect(handle('#unbound-submit').tap()).resolves.toBeUndefined()
    expect(events).toEqual([])
  })

  it('returns the submit result when the activation has no tap listeners', async () => {
    const { handle, events } = await createSession()
    await expect(handle('#projected-submit').tap()).resolves.toBe('submit-result')
    expect(events.map(event => event.type)).toEqual(['submit'])
  })

  it.each([
    ['#caught-child', ['caught-button'], true],
    ['#blocked-child', ['blocked-child'], false],
    ['#below-catch', ['catch-above'], true],
  ] as const)('preserves catch reachability for %s', async (selector, taps, submits) => {
    const { events, tap } = await createSession()
    tap(selector)
    expect(events.filter(event => event.type === 'tap').map(event => event.currentTarget)).toEqual(taps)
    expect(events.filter(event => event.type === 'submit')).toHaveLength(submits ? 1 : 0)
  })

  it('selects the nearest form and never bubbles submit to an enclosing form', async () => {
    const { events, tap } = await createSession()
    tap('#inner-submit')
    expect(events.filter(event => event.type === 'submit')).toEqual([
      { owner: 'page', identity: 1, type: 'submit', target: 'inner-form', currentTarget: 'inner-form', detail: { value: { inner: 'only' } } },
    ])
  })

  it.each(['#projected-submit', '#direct-label'])('admits declared button behaviors and projected fields for %s', async (selector) => {
    const { events, tap } = await createSession()
    tap(selector)
    expect(events.filter(event => event.type === 'submit')).toEqual([
      { owner: 'page', identity: 1, type: 'submit', target: 'boundary-form', currentTarget: 'boundary-form', detail: { value: { outside: 'public', grouped: 'group value', projected: 'slot value' } } },
    ])
  })

  it.each(['#private-button', '#encapsulated-label'])('refuses a private boundary without the button behavior for %s', async (selector) => {
    const { events, tap } = await createSession()
    tap(selector)
    expect(events.filter(event => event.type === 'submit')).toEqual([])
  })

  it('keeps native and both collapsed host tap bindings in their original owners exactly once', async () => {
    const { events, tap } = await createSession()
    tap('#encapsulated-label')
    expect(events).toEqual([
      { owner: 'button-component', type: 'tap', target: 'encapsulated-label', currentTarget: 'encapsulated-button' },
      { owner: 'shell-component', type: 'tap', target: 'encapsulated-label', currentTarget: 'inner-host' },
      { owner: 'page-host', type: 'tap', target: 'encapsulated-label', currentTarget: 'shell-host' },
    ])
  })

  it('uses the original component form owner through normal slots and collapsed roots', async () => {
    const { events, tap } = await createSession()
    tap('#slotted-label')
    expect(events.filter(event => event.type === 'submit')).toEqual([
      { owner: 'form-component', identity: 1, type: 'submit', target: 'component-form', currentTarget: 'component-form', detail: { value: { slotted: 'in form slot' } } },
    ])
  })

  it.each(['remove', 'remove-and-render', 'reLaunch'])('snapshots submit ownership before tap callbacks request %s', async (action) => {
    const { session, page, events, tap } = await createSession()
    await setDataAndCommit(page, { action })
    tap('#slotted-label')
    expect(page.data.visible).toBe(false)
    expect(events.filter(event => event.type === 'submit')).toEqual([
      { owner: 'form-component', identity: 1, type: 'submit', target: 'component-form', currentTarget: 'component-form', detail: { value: { slotted: 'in form slot' } } },
    ])
    if (action === 'reLaunch') {
      await vi.waitFor(() => expect(session.getCurrentPages().at(-1)).not.toBe(page))
    }
  })

  it('collects updated rendered field bindings rather than unrelated page data', async () => {
    const { page, events, handle } = await createSession()
    await handle('#input').input('edited')
    await setDataAndCommit(page, { outside: 'not a native field', text: 'not the bound value' })
    await handle('#submit').tap()
    expect(events.at(-1)!.detail.value).toEqual({ ...nativeFormValue, text: 'edited' })
  })

  it('waits for both async tap and submit handlers while preserving the tap result', async () => {
    const { page, handle } = await createSession()
    let releaseTap!: () => void
    let releaseSubmit!: () => void
    const tapGate = new Promise<void>((resolve) => {
      releaseTap = resolve
    })
    const submitGate = new Promise<void>((resolve) => {
      releaseSubmit = resolve
    })
    const order: string[] = []
    page.onTap = async () => {
      order.push('tap:start')
      await tapGate
      order.push('tap:end')
      return 'tap-value'
    }
    page.onSubmit = async () => {
      order.push('submit:start')
      await submitGate
      order.push('submit:end')
      return 'submit-value'
    }
    let settled = false
    const pending = handle('#submit').tap().then((result) => {
      settled = true
      return result
    })
    expect(order).toEqual(['tap:start', 'submit:start'])
    releaseTap()
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    releaseSubmit()
    expect(await pending).toBe('tap-value')
    expect(order).toEqual(['tap:start', 'submit:start', 'tap:end', 'submit:end'])
  })

  it.each(['tap', 'submit'])('preserves async %s errors without suppressing the other handler', async (source) => {
    const { page, events, handle } = await createSession()
    const failure = new Error(`${source} failed`)
    page[source === 'tap' ? 'onTap' : 'onSubmit'] = async () => {
      throw failure
    }
    await expect(handle('#submit').tap()).rejects.toBe(failure)
    expect(events.some(event => event.type === (source === 'tap' ? 'submit' : 'tap'))).toBe(true)
  })

  it.each([false, true])('settles an earlier asynchronous tap when submit throws synchronously (tap rejects: %s)', async (tapRejects) => {
    const { page, handle } = await createSession()
    const submitFailure = new Error('synchronous submit failure')
    const tapFailure = new Error('later tap failure')
    let resolveTap!: () => void
    let rejectTap!: (error: Error) => void
    const tapResult = new Promise<void>((resolve, reject) => {
      resolveTap = resolve
      rejectTap = reject
    })
    page.onTap = () => tapResult
    page.onSubmit = () => {
      throw submitFailure
    }
    let settled = false
    let failure: unknown
    const pending = handle('#submit').tap().catch((error) => {
      failure = error
    }).finally(() => {
      settled = true
    })
    try {
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(settled).toBe(false)
      if (tapRejects) {
        rejectTap(tapFailure)
      }
      else {
        resolveTap()
      }
      await pending
      if (tapRejects) {
        expect(failure).toBeInstanceOf(AggregateError)
        expect((failure as AggregateError).cause).toBe(submitFailure)
        expect((failure as AggregateError).errors).toEqual([submitFailure, tapFailure])
      }
      else {
        expect(failure).toBe(submitFailure)
      }
    }
    finally {
      resolveTap()
      await tapResult.catch(() => {})
      await pending
    }
  })

  it.each(['tap', 'submit'])('preserves synchronous %s errors and existing default-action ordering', async (source) => {
    const { page, events, handle } = await createSession()
    const failure = new Error(`${source} failed`)
    page[source === 'tap' ? 'onTap' : 'onSubmit'] = () => {
      throw failure
    }
    await expect(handle('#submit').tap()).rejects.toBe(failure)
    expect(events.some(event => event.type === 'submit')).toBe(false)
    expect(events.some(event => event.type === 'tap')).toBe(source === 'submit')
  })
})

it('submits through the public testing bridge with one tap and one submit', async () => {
  const miniProgram = await launch({ projectPath: createProject() })
  sessions.push(miniProgram)
  const page = await miniProgram.reLaunch('/pages/index/index')
  await (await page.$('#nested'))!.tap()
  expect(await page.data('taps')).toBe(1)
  expect(await page.data('submissions')).toBe(1)
})
