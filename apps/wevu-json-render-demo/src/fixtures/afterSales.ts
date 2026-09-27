import type { DemoSpec } from '../runtime/schema'

export const afterSalesSpec: DemoSpec = {
  root: 'root',
  elements: {
    root: { type: 'Stack', props: {}, children: ['order', 'form', 'status'] },
    order: { type: 'OrderSummary', props: { number: 'DEMO-2026-001', product: '日常随行杯 · 雾白', amount: '129.00' }, children: [] },
    form: { type: 'Card', props: { title: '申请售后' }, children: ['reason', 'hint', 'submit', 'error'] },
    reason: { type: 'Input', props: { label: '遇到了什么问题？', placeholder: '例如：收到的杯盖有划痕', value: { $bindState: '/form/reason' } }, children: [] },
    hint: { type: 'Text', props: { text: '请描述商品问题，方便我们为你处理。' }, visible: { $state: '/form/reason', eq: '' }, children: [] },
    submit: { type: 'Button', props: { label: '提交申请', disabled: { $state: '/busy' } }, on: { press: { action: 'submit' } }, children: [] },
    error: { type: 'Text', props: { text: { $state: '/error' } }, visible: { $state: '/error' }, children: [] },
    status: { type: 'Text', props: { text: { $state: '/status' } }, children: [] },
  },
}

// 先挂引用再补节点，覆盖流式过程中暂时不完整的树。
export const recordedStream = [
  { op: 'add', path: '/elements/root/children/-', value: 'progress' },
  { op: 'add', path: '/elements/progress', value: { type: 'Text', props: { text: '正在补充服务说明…' }, children: [] } },
  { op: 'replace', path: '/elements/form/props/title', value: '申请售后 · 专属服务' },
  { op: 'replace', path: '/elements/progress/props/text', value: '预计 24 小时内处理，我们会及时通知你。' },
  { op: 'remove', path: '/elements/form/children/1' },
  { op: 'remove', path: '/elements/hint' },
].map(patch => JSON.stringify(patch)).join('\n') + '\n'

export function streamChunks(text: string) {
  const sizes = [7, 19, 3, 53]
  const chunks: string[] = []
  for (let offset = 0; offset < text.length;) {
    const size = sizes[chunks.length % sizes.length]!
    chunks.push(text.slice(offset, offset + size))
    offset += size
  }
  return chunks
}
