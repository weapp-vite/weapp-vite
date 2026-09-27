import type { NodeEvent } from './projection'
import type { DemoSpec } from './schema'
import { reactive } from 'wevu'
import { afterSalesSpec, recordedStream, streamChunks } from '../fixtures/afterSales'
import { recordDisposedTasks } from './metrics'
import { initialState, inputBinding } from './projection'
import { validateSpec } from './schema'
import { createDemoStream } from './stream'

export function createDemoSession() {
  const model = reactive({
    spec: validateSpec(afterSalesSpec).spec,
    state: initialState(),
    error: '',
    playing: false,
    submissions: 0,
    commits: 0,
  })
  let disposed = false
  let streamTimer: ReturnType<typeof setTimeout> | undefined
  let submitTimer: ReturnType<typeof setTimeout> | undefined
  let stream = createDemoStream(model.spec)

  function cancel() {
    clearTimeout(streamTimer)
    clearTimeout(submitTimer)
    streamTimer = undefined
    submitTimer = undefined
    model.playing = false
    model.state.busy = false
  }

  function load(spec: unknown = afterSalesSpec) {
    if (disposed) {
      return
    }
    try {
      const checked = validateSpec(spec).spec
      cancel()
      model.spec = checked
      model.state = initialState()
      model.error = ''
      model.submissions = 0
      model.commits = 0
      stream = createDemoStream(checked)
    }
    catch (error) {
      model.error = error instanceof Error ? error.message : String(error)
    }
  }

  function receive(event: NodeEvent) {
    if (disposed) {
      return
    }
    if (event.name === 'input' && inputBinding(model.spec, event.id, model.state) === '/form/reason') {
      model.state.form.reason = event.value ?? ''
      return
    }
    const node = model.spec.elements[event.id]
    if (event.name !== 'press' || node?.type !== 'Button' || node.on.press.action !== 'submit' || model.state.busy) {
      return
    }
    if (!model.state.form.reason.trim()) {
      model.state.error = '请先填写售后原因'
      return
    }
    const reason = model.state.form.reason
    model.submissions++
    model.state.busy = true
    model.state.submitted = false
    model.state.error = ''
    model.state.status = '正在提交申请…'
    submitTimer = setTimeout(() => {
      submitTimer = undefined
      if (disposed) {
        return
      }
      model.state.busy = false
      if (reason.includes('失败')) {
        model.state.error = '模拟服务暂不可用，请修改原因后重试'
        model.state.status = '提交未完成'
      }
      else {
        model.state.submitted = true
        model.state.status = '申请已提交，我们会尽快联系你'
      }
    }, 600)
  }

  function push(chunk: string, done = false) {
    if (disposed) {
      return
    }
    try {
      const spec = stream.push(chunk, done)
      if (spec) {
        model.spec = spec
        model.commits++
      }
    }
    catch (error) {
      clearTimeout(streamTimer)
      streamTimer = undefined
      model.playing = false
      model.error = error instanceof Error ? error.message : String(error)
    }
  }

  function play() {
    if (disposed || model.playing) {
      return
    }
    model.error = ''
    model.playing = true
    // 从固定结构重放，同时保留独立业务状态。
    model.spec = validateSpec(afterSalesSpec).spec
    stream = createDemoStream(model.spec)
    const chunks = streamChunks(recordedStream)
    let index = 0
    const step = () => {
      streamTimer = undefined
      const done = index === chunks.length - 1
      push(chunks[index++]!, done)
      if (!model.playing || done) {
        model.playing = false
        return
      }
      streamTimer = setTimeout(step, 25)
    }
    streamTimer = setTimeout(step, 25)
  }

  return {
    model,
    load,
    receive,
    play,
    push,
    reset: () => load(afterSalesSpec),
    dispose() {
      cancel()
      disposed = true
      recordDisposedTasks(Number(streamTimer !== undefined) + Number(submitTimer !== undefined))
    },
  }
}

export type DemoSession = ReturnType<typeof createDemoSession>
export type { DemoSpec }
