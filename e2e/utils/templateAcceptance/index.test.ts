import { describe, expect, it, vi } from 'vitest'
import { assertTemplateRouteCoverage, renderedText, resolveTemplateDomPlan, tapTemplateNode, templatePage } from './index'

describe('template DOM route coverage', () => {
  const plan = [templatePage('/pages/index/index', [renderedText('#counter', '0')])]

  it('matches routes independently of app ordering and leading slashes', () => {
    expect(() => assertTemplateRouteCoverage(['pages/index/index'], plan)).not.toThrow()
  })

  it('rejects a new app page without a DOM plan', () => {
    expect(() => assertTemplateRouteCoverage(['pages/index/index', 'pages/extra/index'], plan)).toThrow('missing=pages/extra/index')
  })

  it('rejects stale and duplicate route plans', () => {
    expect(() => assertTemplateRouteCoverage([], plan)).toThrow('stale=pages/index/index')
    expect(() => assertTemplateRouteCoverage(['pages/index/index'], [...plan, ...plan])).toThrow('duplicate routes')
  })

  it('rejects checkpoints attached to a different route', () => {
    const wrong = structuredClone(plan)
    wrong[0]!.steps[0]!.route = '/pages/wrong/index'
    expect(() => assertTemplateRouteCoverage(['pages/index/index'], wrong)).toThrow('must belong to their declared route')
  })

  it('keeps logical expectations while limiting layout evidence to IDE', () => {
    const routes = [templatePage('/pages/index/index', [
      { ...renderedText('#label', '0'), visible: true },
    ], [
      { id: 'style:updated', action: 'update CSS variable', provider: 'devtools', nodes: [{ selector: '#probe', styles: { color: 'rgb(0, 0, 0)' } }] },
    ])]
    const headless = resolveTemplateDomPlan(routes, 'headless')
    expect(headless[0]!.steps).toHaveLength(1)
    expect(headless[0]!.steps[0]!.nodes[0]).toEqual(renderedText('#label', '0'))
    expect(routes[0]!.steps[0]!.nodes[0]!.visible).toBe(true)
    expect(resolveTemplateDomPlan(routes, 'devtools')[0]!.steps).toHaveLength(2)
  })
})

describe('template DOM interactions', () => {
  it('queries each component boundary before tapping the rendered node', async () => {
    const tap = vi.fn(async () => {})
    const child = { $$: vi.fn(async () => [{ tap }]) }
    const page = { $$: vi.fn(async () => [child]) }
    await tapTemplateNode(page, { selector: 'button', scope: ['count-control'] })
    expect(page.$$).toHaveBeenCalledWith('count-control', { fallback: false, timeout: 5_000 })
    expect(child.$$).toHaveBeenCalledWith('button', { fallback: false, timeout: 5_000 })
    expect(tap).toHaveBeenCalledOnce()
  })

  it('propagates query failures instead of treating them as a missing node', async () => {
    const page = {
      $$: vi.fn(async () => {
        throw new Error('protocol unavailable')
      }),
    }
    await expect(tapTemplateNode(page, { selector: '#counter' })).rejects.toThrow('protocol unavailable')
  })

  it('locates a generic component by its owned descendant', async () => {
    const tap = vi.fn(async () => {})
    const button = { tap }
    const unrelated = { $$: vi.fn(async () => []) }
    const counter = { $$: vi.fn(async () => [button]) }
    const page = { $$: vi.fn(async () => [unrelated, counter]) }
    await tapTemplateNode(page, { selector: 'button', scope: [{ has: '#counter' }] })
    expect(page.$$).toHaveBeenCalledWith('component', { fallback: false, timeout: 5_000 })
    expect(counter.$$).toHaveBeenCalledWith('#counter', { fallback: false, timeout: 5_000 })
    expect(tap).toHaveBeenCalledOnce()
  })
})
