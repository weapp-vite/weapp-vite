import { createJsonRenderer } from '@wevu/json-render'
import { computed, reactive } from 'wevu'
import { catalog } from '../catalog'
import { afterSalesSpec, recordedStream, streamChunks } from '../fixtures/afterSales'
import { initialState } from '../state'
import { recordDisposedTasks } from './metrics'

export function createDemoSession() {
  const activity = reactive({ playing: false, submissions: 0, commits: 0 })
  const renderer = createJsonRenderer({
    catalog,
    spec: afterSalesSpec,
    initialState: initialState(),
    actions: {
      inspect(_params, context) {
        context.setState('/status', '演示订单：DEMO-2026-001，实付 ¥129.00')
      },
      async submit(_params, context) {
        const reason = context.state.form.reason.trim()
        if (!reason) {
          context.setState('/error', '请先填写售后原因')
          return
        }
        activity.submissions++
        context.setState('/busy', true)
        context.setState('/submitted', false)
        context.setState('/error', '')
        context.setState('/status', '正在提交申请…')
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 600)
          context.onCleanup(() => {
            clearTimeout(timer)
            resolve()
          })
        })
        context.setState('/busy', false)
        if (reason.includes('失败')) {
          context.setState('/error', '模拟服务暂不可用，请修改原因后重试')
          context.setState('/status', '提交未完成')
        }
        else {
          context.setState('/submitted', true)
          context.setState('/status', '申请已提交，我们会尽快联系你')
        }
      },
    },
  })
  const model = computed(() => ({
    spec: renderer.spec.value,
    state: { ...renderer.state, form: { ...renderer.state.form } },
    error: renderer.error.value ?? '',
    playing: activity.playing,
    submissions: activity.submissions,
    commits: activity.commits,
  }))
  let stream = renderer.createStream()
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function stopPlayback() {
    clearTimeout(timer)
    timer = undefined
    activity.playing = false
  }
  function load(spec: unknown = afterSalesSpec) {
    if (!disposed && renderer.load(spec, initialState())) {
      stopPlayback()
      activity.submissions = 0
      activity.commits = 0
      stream = renderer.createStream()
    }
  }
  function push(chunk: string, done = false) {
    if (disposed) {
      return
    }
    if (stream.push(chunk, done)) {
      activity.commits++
    }
    if (renderer.error.value) {
      stopPlayback()
    }
  }
  function play() {
    if (disposed || activity.playing) {
      return
    }
    stream = renderer.createStream(afterSalesSpec)
    activity.playing = true
    const chunks = streamChunks(recordedStream)
    let index = 0
    const step = () => {
      timer = undefined
      const done = index === chunks.length - 1
      push(chunks[index++]!, done)
      if (!activity.playing || done) {
        activity.playing = false
        return
      }
      timer = setTimeout(step, 25)
    }
    timer = setTimeout(step, 25)
  }
  return {
    model,
    tree: renderer.tree,
    load,
    receive: renderer.dispatch,
    play,
    push,
    reset: () => load(),
    dispose() {
      disposed = true
      stopPlayback()
      renderer.dispose()
      recordDisposedTasks(Number(timer !== undefined) + renderer.pending.value.length)
    },
  }
}
