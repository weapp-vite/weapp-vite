import type { DomCheckpoint, DomNodeExpectation, DomProvider, DomScope } from '../domAcceptance/types'

export interface TemplateDomStep extends DomCheckpoint {
  tap?: { selector: string, scope?: DomScope[] }
  method?: string
  provider?: DomProvider
}

export interface TemplateDomRoute {
  route: string
  steps: TemplateDomStep[]
}

export function templatePage(route: string, nodes: DomNodeExpectation[], updates: Omit<TemplateDomStep, 'route'>[] = []): TemplateDomRoute {
  return {
    route,
    steps: [
      { id: `${route}:initial`, route, action: 'reLaunch and inspect the initial rendered page', nodes },
      ...updates.map(step => ({ ...step, route })),
    ],
  }
}

export function renderedText(selector: string, text: string, scope: DomScope[] = []): DomNodeExpectation {
  return { selector, text, scope }
}

export function resolveTemplateDomPlan(routes: TemplateDomRoute[], provider: DomProvider): TemplateDomRoute[] {
  return routes.map(route => ({
    ...route,
    steps: route.steps.filter(step => !step.provider || step.provider === provider).map(step => ({
      ...step,
      action: provider === 'headless' ? `${step.action} (logical nodes; layout requires IDE acceptance)` : step.action,
      nodes: step.nodes.map(({ styles, visible, ...node }) => provider === 'headless' ? node : { ...node, styles, visible }),
    })),
  }))
}

export function assertTemplateRouteCoverage(pages: string[], routes: TemplateDomRoute[]) {
  const normalize = (route: string) => route.replace(/^\/+|\/+$/g, '')
  const planned = routes.map(item => normalize(item.route))
  if (new Set(planned).size !== planned.length) {
    throw new Error('Template DOM acceptance contains duplicate routes')
  }
  const missing = pages.filter(page => !planned.includes(normalize(page)))
  const stale = planned.filter(route => !pages.some(page => normalize(page) === route))
  if (missing.length || stale.length) {
    throw new Error(`Template DOM route coverage mismatch: missing=${missing.join(',')} stale=${stale.join(',')}`)
  }
  for (const item of routes) {
    if (!item.steps.length || item.steps.some(step => normalize(step.route) !== normalize(item.route))) {
      throw new Error(`Template DOM checkpoints must belong to their declared route: ${item.route}`)
    }
  }
}

export async function tapTemplateNode(page: any, target: NonNullable<TemplateDomStep['tap']>) {
  let owner = page
  for (const scope of target.scope ?? []) {
    let matches = await owner.$$(typeof scope === 'string' ? scope : 'component', { fallback: false, timeout: 5_000 })
    if (typeof scope !== 'string') {
      const scoped = []
      for (const component of matches) {
        const descendants = await component.$$(scope.has, { fallback: false, timeout: 5_000 })
        if (descendants.length > 0) {
          scoped.push(component)
        }
      }
      matches = scoped
    }
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one template component scope: ${JSON.stringify(scope)}`)
    }
    owner = matches[0]
  }
  const matches = await owner.$$(target.selector, { fallback: false, timeout: 5_000 })
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one template tap target: ${target.selector}`)
  }
  await matches[0].tap()
}
