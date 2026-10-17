import type { HeadlessSession } from '@mpcore/simulator'
import type { MiniProgramComponentRenderResult, MiniProgramRenderResult } from '../types'
import type { createComponentEvents } from './events'
import type { createComponentHostProject } from './host'
import { cloneComponentData } from './data'
import { COMPONENT_SUBJECT_SELECTOR } from './host'

/** 复用宿主会话更新与移除真实组件，不重新构造主体实例。 */
export function createComponentRenderResult(
  base: MiniProgramRenderResult,
  session: HeadlessSession,
  settle: () => Promise<void>,
  host: ReturnType<typeof createComponentHostProject>,
  events: ReturnType<typeof createComponentEvents>,
): MiniProgramComponentRenderResult {
  let mounted = true
  let unmounting: Promise<void> | undefined
  const assertMounted = () => {
    session.assertActive()
    if (!mounted) {
      throw new Error('The test component has been unmounted.')
    }
  }
  events.setChangeHandler(() => {
    session.renderCurrentPage()
  })
  const refresh = async () => {
    await settle()
    await base.screen.refresh()
  }
  return Object.assign(base, {
    off: events.off,
    on(eventName, listener) {
      assertMounted()
      return events.on(eventName, listener)
    },
    async setData(data) {
      assertMounted()
      const payload = cloneComponentData(data, 'Component data')
      const subject = session.selectComponent(COMPONENT_SUBJECT_SELECTOR)
      if (!subject) {
        throw new Error('The test component is no longer mounted.')
      }
      await new Promise<void>((resolve) => {
        subject.setData(payload, resolve)
      })
      await refresh()
    },
    async setProperties(properties) {
      assertMounted()
      const payload = cloneComponentData(properties, 'Component properties')
      host.addPropertyNames(Object.keys(payload))
      const previous = await base.page.data('__mpcoreProperties') as Record<string, unknown>
      await base.page.setData({ __mpcoreProperties: { ...previous, ...payload } })
      await refresh()
    },
    async unmount() {
      if (unmounting) {
        return await unmounting
      }
      session.assertActive()
      mounted = false
      unmounting = (async () => {
        try {
          await base.page.setData({ __mpcoreMounted: false })
        }
        finally {
          events.clear()
        }
        await refresh()
      })()
      return await unmounting
    },
  } satisfies Omit<MiniProgramComponentRenderResult, keyof MiniProgramRenderResult>)
}
