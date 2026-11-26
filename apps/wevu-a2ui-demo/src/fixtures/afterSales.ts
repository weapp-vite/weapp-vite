import type { A2uiActionMessage } from '@wevu/a2ui'
import { DEMO_CATALOG_ID } from '../catalog'

/** 演示只使用单个 surface，便于断言 generation 与模板列表重建。 */
export const SURFACE_ID = 'after-sales'

function envelope(type: string, payload: Record<string, unknown>) {
  return { version: '1.0', [type]: payload }
}

function setPath(path: string, value: unknown) {
  return envelope('updateDataModel', { surfaceId: SURFACE_ID, path, value })
}

function setComponents(components: unknown[]) {
  return envelope('updateComponents', { surfaceId: SURFACE_ID, components })
}

function reasonChecks() {
  const value = { '@path': '/form/reason' }
  return [
    { condition: { '@call': 'required', args: { value } }, message: '请填写售后原因' },
    { condition: { '@call': 'length', args: { value, min: 4 } }, message: '至少填写四个字' },
  ]
}

/**
 * 首屏：一条 createSurface 同时给出组件表与数据模型。
 *
 * Core 会保留 dataModel 对象引用并在写回时就地修改，因此每次下发都重新构造。
 */
export function createInitialMessages(): unknown[] {
  return [
    envelope('createSurface', {
      surfaceId: SURFACE_ID,
      catalogId: DEMO_CATALOG_ID,
      components: [
        { id: 'root', component: 'Column', children: ['order', 'form', 'progressList', 'status', 'error'] },
        { id: 'order', component: 'OrderSummary', number: 'DEMO-2026-001', product: '日常随行杯 · 雾白', amount: '129.00' },
        { id: 'form', component: 'Card', child: 'formInner' },
        { id: 'formInner', component: 'Column', children: ['formTitle', 'reason', 'detail', 'hint', 'submit', 'inspect'] },
        { id: 'formTitle', component: 'Text', text: { '@path': '/form/title' }, variant: 'caption' },
        {
          id: 'reason',
          component: 'TextField',
          label: '遇到了什么问题？',
          placeholder: '例如：收到的杯盖有划痕',
          value: { '@path': '/form/reason' },
          '@checks': reasonChecks(),
        },
        {
          id: 'detail',
          component: 'TextField',
          label: '补充说明',
          placeholder: '选填：物流、包装等细节',
          value: { '@path': '/form/detail' },
          variant: 'longText',
        },
        { id: 'hint', component: 'Text', text: { '@path': '/form/hint' }, variant: 'caption' },
        {
          id: 'submit',
          component: 'Button',
          child: 'submitLabel',
          variant: 'primary',
          action: { event: { name: 'submit', context: { reason: { '@path': '/form/reason' } } } },
          '@checks': [{
            condition: { '@call': 'and', args: { values: reasonChecks().map(check => check.condition) } },
            message: '请先填写有效的售后原因',
          }],
        },
        { id: 'submitLabel', component: 'Text', text: '提交申请' },
        { id: 'inspect', component: 'Button', child: 'inspectLabel', action: { event: { name: 'inspect' } } },
        { id: 'inspectLabel', component: 'Text', text: '查看订单信息' },
        { id: 'progressList', component: 'List', children: { componentId: 'stepItem', path: '/steps' } },
        { id: 'stepItem', component: 'Text', text: { '@path': 'label' }, variant: 'caption' },
        { id: 'status', component: 'Text', text: { '@path': '/status' } },
        { id: 'error', component: 'Text', text: { '@path': '/error' }, variant: 'caption' },
      ],
      dataModel: {
        form: { title: '申请售后', reason: '', detail: '', hint: '请描述商品问题，方便我们为你处理。' },
        steps: [{ label: '已收到申请' }, { label: '等待补充信息' }],
        status: '填写原因后提交申请',
        error: '',
      },
    }),
  ]
}

/** 增量：新增可到达节点、按 id 覆写组件属性、改写数据模型；A2UI 不提供删除组件，隐藏通过数据绑定表达。 */
export const streamedMessages: unknown[] = [
  setComponents([
    { id: 'root', component: 'Column', children: ['order', 'form', 'progress', 'progressList', 'status', 'error'] },
    { id: 'progress', component: 'Text', text: '正在补充服务说明…', variant: 'caption' },
  ]),
  setComponents([
    { id: 'progress', component: 'Text', text: '预计 24 小时内处理，我们会及时通知你。', variant: 'caption' },
  ]),
  setPath('/form/title', '申请售后 · 专属服务'),
  setPath('/form/hint', ''),
  setPath('/steps', [{ label: '已收到申请' }, { label: '等待补充信息' }, { label: '专属客服跟进中' }]),
]

/** 目录未声明的组件类型：必须整批拒绝并保留上一版界面。 */
export const invalidMessage = setComponents([
  { id: 'progress', component: 'NoSuchComponent', text: '不该出现' },
])

/** 提交动作的即时回执，模拟 agent 处理中。 */
export const pendingMessage = setPath('/status', '正在提交申请…')

/** 基础目录页：不依赖任何业务组件。 */
export const basicMessages: unknown[] = [
  envelope('createSurface', {
    surfaceId: 'basic',
    catalogId: DEMO_CATALOG_ID,
    components: [
      { id: 'root', component: 'Tabs', tabs: [{ title: '嵌套文本', child: 'textTab' }, { title: '嵌套输入', child: 'inputTab' }] },
      { id: 'textTab', component: 'Column', children: ['label'] },
      { id: 'label', component: 'Text', text: { '@path': '/message' } },
      { id: 'inputTab', component: 'Column', children: ['nestedField'] },
      { id: 'nestedField', component: 'TextField', label: '修改文本', value: { '@path': '/message' } },
    ],
    dataModel: { message: '基础组件无需业务适配' },
  }),
]

export const BASIC_SURFACE_ID = 'basic'

/** 假的 agent 回包：动作外发后由服务端改写数据模型。 */
export function agentReplies(message: A2uiActionMessage): unknown[] {
  const { name, context = {} } = message.action
  if (name === 'inspect') {
    return [setPath('/status', '演示订单：DEMO-2026-001，实付 ¥129.00')]
  }
  if (name !== 'submit') {
    return []
  }
  const reason = String(context.reason ?? '').trim()
  if (!reason) {
    return [setPath('/error', '请先填写售后原因')]
  }
  if (reason.length < 4) {
    return [setPath('/error', '请至少填写四个字')]
  }
  if (reason.includes('失败')) {
    return [
      setPath('/error', '模拟服务暂不可用，请修改原因后重试'),
      setPath('/status', '提交未完成'),
    ]
  }
  return [
    setPath('/error', ''),
    setPath('/status', '申请已提交，我们会尽快联系你'),
    setPath('/steps', [{ label: '已收到申请' }, { label: '等待补充信息' }, { label: '客服已受理' }]),
  ]
}
