import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { compileScript, parse } from '@vue/compiler-sfc'
import { DomUtils, parseDocument } from 'htmlparser2'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { compileVueTemplateToWxml } from '../../wevu-compiler/src/plugins/vue/compiler/template'
import { runInlineExpression } from '../src/runtime/register/inline'

const templateRoot = new URL('../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/', import.meta.url)

function readComponent(file: string) {
  const filename = fileURLToPath(new URL(file, templateRoot))
  const result = parse(readFileSync(filename, 'utf8'), { filename })
  expect(result.errors).toEqual([])
  return result.descriptor
}

function loadHandler(file: string, name: string, globals: Record<string, unknown>) {
  const descriptor = readComponent(file)
  const script = descriptor.scriptSetup!.content
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const declaration = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name)
  expect(declaration, name).toBeDefined()
  const code = ts.transpileModule(declaration!.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText
  return runInNewContext(`${code}\n${name}`, globals) as (...args: unknown[]) => unknown
}

function dispatchComponentEvent(file: string, handler: string, context: Record<string, unknown>, detail: unknown, index = 0) {
  const compiled = compileVueTemplateToWxml(readComponent(file).template!.content, file)
  const entry = compiled.inlineExpressions?.find(item => item.expression.includes(`ctx.${handler}(`))
  expect(entry, handler).toBeDefined()
  const dataset: Record<string, unknown> = { wvEventDetail: true, wvInlineId: entry!.id, index }
  entry!.scopeKeys.forEach((key, position) => {
    expect(key).toBe('index')
    dataset[`wvS${position}`] = index
  })
  const fn = runInNewContext(`(ctx, scope, $event) => (${entry!.expression})`) as (ctx: unknown, scope: unknown, event: unknown) => unknown
  return runInlineExpression(context, undefined, { detail, currentTarget: { dataset } }, {
    [entry!.id]: { keys: entry!.scopeKeys, fn },
  })
}

describe('retail template component event payloads', () => {
  it('emits the goods payload from a native card tap', () => {
    const goods = { spuId: 'goods-a', title: 'First item' }
    const emit = vi.fn()
    const clickHandle = loadHandler('components/goods-card/index.vue', 'clickHandle', { emit, goods: { value: goods } })
    clickHandle()
    expect(emit).toHaveBeenCalledExactlyOnceWith('click', { goods })
  })

  it.each([
    ['onClickGoods', 'click'],
    ['onAddCart', 'addcart'],
    ['onClickGoodsThumb', 'thumb'],
  ])('forwards %s with its loop index and unwrapped goods payload', (handler, eventName) => {
    const goods = { spuId: 'goods-b', title: 'Second item' }
    const emit = vi.fn()
    const file = 'components/goods-list/index.vue'
    const context = { [handler]: loadHandler(file, handler, { emit }) }

    dispatchComponentEvent(file, handler, context, { goods }, 1)

    expect(emit).toHaveBeenCalledExactlyOnceWith(eventName, { goods, index: 1 })
  })

  it.each([
    { file: 'pages/home/home.vue', handler: 'goodListClickHandle', stateKey: 'goodsList' },
    { file: 'pages/goods/list/index.vue', handler: 'gotoGoodsDetail', stateKey: 'goodsList' },
    { file: 'pages/goods/result/index.vue', handler: 'gotoGoodsDetail', stateKey: 'goodsList' },
    { file: 'pages/coupon/coupon-activity-goods/index.vue', handler: 'goodClickHandle', stateKey: 'goods' },
    { file: 'pages/promotion/promotion-detail/index.vue', handler: 'goodClickHandle', stateKey: 'list' },
  ])('navigates from $file using the list payload index', async ({ file, handler, stateKey }) => {
    const navigateTo = vi.fn()
    const goodsList = { value: [{ spuId: 'goods-a' }, { spuId: 'goods-b' }] }
    const context = { [handler]: loadHandler(file, handler, { [stateKey]: goodsList, wpi: { navigateTo }, Promise }) }

    await dispatchComponentEvent(file, handler, context, { goods: goodsList.value[1], index: 1 })

    expect(navigateTo).toHaveBeenCalledExactlyOnceWith({ url: '/pages/goods/details/index?spuId=goods-b' })
  })

  it('constructs add-cart identity from card state regardless of event payload', () => {
    const goods = { spuId: 'goods-a' }
    const emit = vi.fn()
    const file = 'components/goods-card/index.vue'
    const handler = 'addCartHandle'
    const addCartHandle = loadHandler(file, handler, { emit, goods: { value: goods }, independentID: { value: 'card-a' } })

    addCartHandle({ x: 120, y: 180 })

    expect(emit).toHaveBeenCalledExactlyOnceWith('add-cart', expect.objectContaining({ goods, id: 'card-a-cart', cardID: 'card-a' }))
  })

  it('passes business cardId independently while preserving the native component id', () => {
    const script = compileScript(readComponent('components/goods-card/index.vue'), { id: 'retail-card' })
    expect(script.bindings?.cardId).toBe('props')
    expect(script.bindings?.id).toBeUndefined()
    const template = parseDocument(readComponent('components/goods-list/index.vue').template!.content)
    const cards = DomUtils.findAll(node => node.name === 'goods-card', template.children)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.attribs[':card-id']).toBe(cards[0]!.attribs[':id'])
    expect(runInNewContext(cards[0]!.attribs[':card-id']!, { independentID: 'home-list', index: 1 })).toBe('home-list-gd-1')
  })

  it('renders the cart action id and tap handler on a native view', () => {
    const template = parseDocument(readComponent('components/goods-card/index.vue').template!.content)
    const buttons = DomUtils.findAll(node => node.attribs.class?.split(/\s+/).includes('goods-card__add-cart') ?? false, template.children)
    expect(buttons).toHaveLength(1)
    const button = buttons[0]!
    expect(button.name).toBe('view')
    expect(button.attribs['@tap.stop']).toBe('addCartHandle')
    expect(runInNewContext(button.attribs[':id']!, { independentID: 'card-a' })).toBe('card-a-cart')
    expect(DomUtils.findAll(node => node.name === 't-icon' && node.attribs.name === 'cartAdd', button.children)).toHaveLength(1)
  })
})

describe('retail comment filter controls', () => {
  it('uses explicit native tap values to reset queries and return to all comments', () => {
    const file = 'pages/goods/comments/index.vue'
    const init = vi.fn()
    const state = {
      commentType: { value: '' },
      commentLevel: { value: '' },
      hasImage: { value: '' },
      loadMoreStatus: { value: 2 },
      commentList: { value: [{ commentContent: 'previous results' }] as unknown[] },
      total: { value: 10 },
      totalCount: { value: 10 },
      pageNum: { value: 3 },
      pageSize: { value: 10 },
      spuId: { value: 'goods-a' },
    }
    const resetListState = loadHandler(file, 'resetListState', state)
    const changeTag = loadHandler(file, 'changeTag', { ...state, resetListState, init })
    const query = loadHandler(file, 'generalQueryData', state)
    const template = parseDocument(readComponent(file).template!.content, { lowerCaseAttributeNames: false })
    const cases = [
      { id: 'image', value: '4', query: { spuId: 'goods-a', hasImage: true } },
      { id: 'good', value: '3', query: { spuId: 'goods-a', commentLevel: 3 } },
      { id: 'all', value: '', query: { spuId: 'goods-a' } },
    ]

    for (const item of cases) {
      const controls = DomUtils.findAll(node => node.attribs.id === `comments-filter-${item.id}`, template.children)
      expect(controls).toHaveLength(1)
      const control = controls[0]!
      expect(control.name).toBe('view')
      expect(control.attribs['@tap']).toBe(`changeTag('${item.value}')`)
      runInNewContext(control.attribs['@tap']!, { changeTag })
      expect(state.commentType.value).toBe(item.value)
      expect(state.commentList.value).toEqual([])
      expect(state.pageNum.value).toBe(1)
      expect(state.loadMoreStatus.value).toBe(0)
      expect(query(true)).toEqual({ pageNum: 1, pageSize: 30, queryParameter: item.query })
      expect(init).toHaveBeenLastCalledWith(true)

      const tags = DomUtils.findAll(node => node.name === 't-tag', control.children)
      expect(tags).toHaveLength(1)
      const tag = tags[0]!
      expect(runInNewContext(tag.attribs[':theme']!, { commentType: item.value })).toBe('danger')
      expect(runInNewContext(tag.attribs[':variant']!, { commentType: item.value })).toBe('light-outline')
      expect(runInNewContext(tag.attribs[':theme']!, { commentType: 'other' })).toBe('default')
      expect(runInNewContext(tag.attribs[':variant']!, { commentType: 'other' })).toBe('dark')
    }
    expect(init).toHaveBeenCalledTimes(3)
    changeTag('')
    expect(init).toHaveBeenCalledTimes(3)
  })
})
