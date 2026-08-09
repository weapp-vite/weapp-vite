import type { BenchPageController, ReactBenchPageRuntime } from '../shared'
import { createReactMiniProgramRoot } from '@weapp-vite/react'
import { createElement, createRef } from 'react'
import { now, patchSetData } from '../../utils/bench'
import { readFirstCommitMs } from '../shared'
import { ReactDetailPage } from './view'

const runtimes = new WeakMap<object, ReactBenchPageRuntime<BenchPageController>>()

Page({
  data: { root: { cn: [] } },
  eh(event: WechatMiniprogram.BaseEvent) {
    runtimes.get(this)?.root.dispatchEvent(event)
  },
  onLoad() {
    const loadStartedAt = now()
    const setDataCounter = { total: 0, firstCommitAt: null }
    patchSetData(this, setDataCounter)
    const controller = createRef<BenchPageController>()
    const root = createReactMiniProgramRoot(this)
    runtimes.set(this, { controller, loadStartedAt, root, setDataCounter })
    root.render(createElement(ReactDetailPage, { ref: controller, setDataCounter }))
  },
  onReady() {
    const runtime = runtimes.get(this)
    const loadStartedAt = runtime?.loadStartedAt ?? now()
    runtime?.controller.current?.finishReady(
      now() - loadStartedAt,
      runtime ? readFirstCommitMs(runtime.setDataCounter, loadStartedAt) : 0,
    )
    runtime?.root.flush()
  },
  onUnload() {
    runtimes.get(this)?.root.unmount()
    runtimes.delete(this)
  },
  readBenchState() {
    return runtimes.get(this)?.controller.current?.readBenchState()
  },
})
