import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import { DomUtils, parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { queryXPathElements } from '../../../mpcore/packages/simulator/src/view/xpath'
import { RETAIL_TEMPLATE_DOM } from './retail'

const templateRoot = new URL('../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/', import.meta.url)

function readTemplate(file: string) {
  const filename = fileURLToPath(new URL(file, templateRoot))
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  expect(errors).toEqual([])
  expect(descriptor.template).not.toBeNull()
  return parseDocument(descriptor.template!.content).children
}

function plannedNodes(route: string) {
  const plan = RETAIL_TEMPLATE_DOM.find(item => item.route === route)
  expect(plan, route).toBeDefined()
  return plan!.steps.flatMap(step => step.nodes)
}

describe('retail template semantic DOM targets', () => {
  it('avoids positional pseudo selectors unsupported by the native IDE query bridge', () => {
    for (const route of RETAIL_TEMPLATE_DOM) {
      for (const step of route.steps) {
        for (const node of step.nodes) {
          const selectors = [node.selector, ...(node.scope ?? []).map(scope => typeof scope === 'string' ? scope : scope.has)]
          for (const selector of selectors) {
            expect(selector).not.toMatch(/:(?:nth|first|last|only)-(?:child|of-type)\b/)
          }
        }
      }
    }
  })

  it.each([
    { file: 'components/filter/index.vue', id: 'filter-overall', text: '综合', templateText: '综合', routes: ['/pages/goods/list/index', '/pages/goods/result/index'], scope: [{ has: '.filter-wrap' }] },
    { file: 'components/filter/index.vue', id: 'filter-price-label', text: '价格', templateText: '价格', routes: ['/pages/goods/list/index', '/pages/goods/result/index'], scope: [{ has: '.filter-wrap' }] },
    { file: 'pages/order/order-detail/index.vue', id: 'order-detail-number', text: '132381532610540875', templateText: '{{ order.orderNo }}', routes: ['/pages/order/order-detail/index'], scope: [] },
    { file: 'pages/order/invoice/index.vue', id: 'invoice-details-title', text: '发票详情', templateText: '发票详情', routes: ['/pages/order/invoice/index'], scope: [] },
    { file: 'pages/order/invoice/index.vue', id: 'invoice-recipient-title', text: '收票人信息', templateText: '收票人信息', routes: ['/pages/order/invoice/index'], scope: [] },
  ])('binds $id to exactly one business node and preserves its text assertion', ({ file, id, text, templateText, routes, scope }) => {
    const matches = DomUtils.findAll(node => node.attribs.id === id, readTemplate(file))
    expect(matches).toHaveLength(1)
    expect(DomUtils.textContent(matches[0]!).trim()).toBe(templateText)
    for (const route of routes) {
      expect(plannedNodes(route)).toContainEqual({ selector: `#${id}`, text, scope })
    }
  })

  it('identifies the payment entry by its business status rather than loop position', () => {
    const matches = DomUtils.findAll(node => node.attribs[':data-order-status'] !== undefined, readTemplate('pages/usercenter/components/order-group/index.vue'))
    expect(matches).toHaveLength(1)
    const target = matches[0]!
    expect(target.attribs[':data-order-status']).toBe('item.tabType')
    expect(target.attribs['v-for']).toBe('(item, index) in orderTagInfos')
    expect(DomUtils.findAll(node => node.attribs.class?.split(/\s+/).includes('order-group__item__title') ?? false, target.children)).toHaveLength(1)
    expect(plannedNodes('/pages/usercenter/index')).toContainEqual({
      selector: '.order-group__item[data-order-status="5"] .order-group__item__title',
      text: '待付款',
      scope: [{ has: '.order-group' }],
    })
  })

  it('checks the default receipt state before selecting an electronic invoice', () => {
    const targets = DomUtils.findAll(node => node.attribs['v-for'] === '(item, index) in receipts', readTemplate('pages/order/receipt/index.vue'))
    expect(targets).toHaveLength(1)
    expect(targets[0]!.attribs[':id']).toBe('item.id === 0 ? \'receipt-none\' : \'receipt-electronic\'')
    expect(targets[0]!.attribs['@tap']).toBe('onLabels')

    const plan = RETAIL_TEMPLATE_DOM.find(item => item.route === '/pages/order/receipt/index')!
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]!.nodes).toEqual([
      { selector: '#receipt-none', text: '不开发票', scope: [] },
      { selector: '#receipt-electronic', text: '电子发票', scope: [] },
      { selector: '.receipt-know', count: 0 },
    ])
    expect(plan.steps[1]!.tap).toEqual({ selector: '#receipt-electronic' })
    expect(plan.steps[1]!.nodes).toContainEqual({ selector: '.receipt-know', text: '发票须知', scope: [] })
    for (const placeholder of ['请输入您的姓名', '请输入您的手机号']) {
      expect(plan.steps[1]!.nodes).toContainEqual({
        selector: 'input',
        scope: [{ has: `input[placeholder="${placeholder}"]` }],
        attributes: { placeholder },
      })
    }
  })

  it('retains collection cardinality checks beside the unique semantic targets', () => {
    expect(plannedNodes('/pages/usercenter/index')).toContainEqual({ selector: '.order-group__item', scope: [{ has: '.order-group' }], count: 5 })
    expect(plannedNodes('/pages/order/order-detail/index')).toContainEqual({ selector: '.order-no', count: 4 })
    expect(plannedNodes('/pages/order/invoice/index')).toContainEqual({ selector: '.invoice-detail-box-value', count: 8 })
  })

  it('checks the five-order first page before loading and checking all seven orders', () => {
    const plan = RETAIL_TEMPLATE_DOM.find(item => item.route === '/pages/order/order-list/index')!
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[1]!.method).toBe('onReachBottom')
    expect(plan.steps[0]!.nodes).toContainEqual({ selector: '.order-number', count: 5 })
    expect(plan.steps[1]!.nodes).toContainEqual({ selector: '.order-number', count: 7 })
    for (const [index, count] of [5, 7].entries()) {
      const nodes = plan.steps[index]!.nodes
      expect(nodes).toContainEqual({ selector: '.bold-price', text: '实付', count })
      expect(nodes.filter(node => node.query === 'xpath' && node.count === 1)).toHaveLength(count)
      expect(nodes.filter(node => node.query === 'xpath' && node.text !== undefined)).toHaveLength(count * 3)
    }
    // 第二页必须追加而非替换第一批订单；订单号和实付金额检查都要保留。
    for (const node of plan.steps[0]!.nodes.filter(node => node.query === 'xpath' && node.text !== undefined)) {
      expect(plan.steps[1]!.nodes).toContainEqual(node)
    }
    expect(plan.steps[0]!.nodes.some(node => node.text?.includes('130150835531421259'))).toBe(false)
    expect(plan.steps[1]!.nodes).toContainEqual(expect.objectContaining({
      selector: expect.stringContaining('integer ")])[7]'),
      text: '40',
    }))
  })

  it('checks the business order of projected order numbers and payments without confusing other card prices', () => {
    // 保留真实 IDE 的投影 slot / price 组件层级，不依赖输出中的组件重命名。
    const rows = [
      ['354021731671873099', '0', '.20'],
      ['132381532610540875', '368', '.00'],
      ['132222623132329291', '4586', '.00'],
      ['130862219672031307', '2632', '.00'],
      ['130494472895208267', '249', '.00'],
      ['130169571554503755', '5082', '.00'],
      ['130150835531421259', '40', '.00'],
    ]
    const fixture = parseDocument(rows.map(([number, integer, decimal]) => `
      <component><view class="order-card wr-class">
        <view class="header"><view class="store-name"><component slot="top-left">
          <view class="order-number"><text>订单号\u00A0 </text> ${number}</view>
        </component></view></view>
        <component slot="more"><view><view class="price-total">
          <component><view class="integer">999</view><view class="decimal">.99</view></component>
          <text class="bold-price">实付</text>
          <component class="real-pay"><view class="price"><view class="pprice">
            <view class="integer">${integer}</view><view class="decimal">${decimal}</view>
          </view></view></component>
        </view></view></component>
      </view></component>
    `).join(''))
    const plan = RETAIL_TEMPLATE_DOM.find(item => item.route === '/pages/order/order-list/index')!
    for (const node of plan.steps[1]!.nodes.filter(node => node.query === 'xpath')) {
      expect(node.selector).not.toContain('[.//')
      const matches = queryXPathElements(fixture, node.selector)
      expect(matches, node.selector).toHaveLength(node.count ?? 1)
      if (node.text !== undefined) {
        expect(DomUtils.textContent(matches[0]!), node.selector).toBe(node.text)
      }
    }
  })

  it('checks service selection before opening the refund form', () => {
    const template = readTemplate('pages/order/apply-service/index.vue')
    const choices = DomUtils.findAll(node => node.attribs['v-if'] === '!serviceRequireType', template)
    expect(choices).toHaveLength(1)
    const refund = DomUtils.findAll(node => node.attribs.title === '申请退款（无需退货）', choices[0]!.children)
    expect(refund).toHaveLength(1)
    expect(refund[0]!.attribs['@tap']).toBe('onApplyOnlyRefund')
    const plan = RETAIL_TEMPLATE_DOM.find(item => item.route === '/pages/order/apply-service/index')!
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0]!.nodes).toContainEqual({ selector: '.textarea--label', count: 0 })
    expect(plan.steps[1]!.tap).toEqual({ selector: '[title="申请退款（无需退货）"]' })
    expect(plan.steps[1]!.nodes).toContainEqual({ selector: '.textarea--label', text: '退款说明', scope: [] })
    expect(plan.steps[1]!.nodes).toContainEqual({ selector: '.service-choice', count: 0 })
  })
})
