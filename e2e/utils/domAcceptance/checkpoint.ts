import type { DomAcceptance, DomCheckpoint, DomCheckpointEvidence, DomPage, DomSession } from './types'
import { setTimeout as delay } from 'node:timers/promises'
import { isDeepStrictEqual } from 'node:util'

export function normalizeDomRoute(route: string) {
  return route.replace(/^\/+|\/+$/g, '')
}

export function validateDomPlan(plan: DomAcceptance) {
  if (!plan.fixture || plan.fixture.startsWith('/') || plan.fixture.includes('..') || plan.fixture.includes('\\')) {
    throw new Error('DOM fixture must be a repository-relative POSIX path')
  }
  if (!plan.checkpoints.length) {
    throw new Error('DOM acceptance requires named checkpoints')
  }
  const ids = new Set<string>()
  for (const checkpoint of plan.checkpoints) {
    if (!checkpoint.id || ids.has(checkpoint.id) || !checkpoint.route || !checkpoint.action || !checkpoint.nodes.length) {
      throw new Error(`Invalid or duplicate DOM checkpoint: ${checkpoint.id}`)
    }
    ids.add(checkpoint.id)
    const errors = checkpoint.expectedErrors ?? []
    const keys = errors.map(error => JSON.stringify([error.source, error.level, error.channel, error.text]))
    if (new Set(keys).size !== keys.length || errors.some(error => !['build', 'runtime'].includes(error.source)
      || !['error', 'exception'].includes(error.level) || !error.channel.trim() || !error.text.trim()
      || !Number.isInteger(error.count) || error.count < 1)) {
      throw new Error(`Expected DOM errors must have unique exact matches and positive counts: ${checkpoint.id}`)
    }
    const hasBehavior = checkpoint.nodes.some(node => node.text !== undefined
      || node.count === 0
      || (node.count !== undefined && node.count > 1)
      || Object.keys(node.styles ?? {}).length > 0
      || Object.keys(node.attributes ?? {}).some(key => key !== 'id' && !key.startsWith('data-')))
    if (!hasBehavior) {
      throw new Error(`DOM checkpoint ${checkpoint.id} only checks readiness; add a rendered behavior assertion`)
    }
    for (const node of checkpoint.nodes) {
      if (!node.selector || (node.count !== undefined && (!Number.isInteger(node.count) || node.count < 0))) {
        throw new Error(`Invalid DOM selector/count: ${checkpoint.id}`)
      }
      if (plan.provider === 'headless' && (node.visible !== undefined || Object.keys(node.styles ?? {}).length)) {
        throw new Error('Headless logical nodes cannot provide layout or computed-style acceptance')
      }
    }
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

async function assertRoute(session: DomSession, page: DomPage, checkpoint: DomCheckpoint) {
  const route = normalizeDomRoute(checkpoint.route)
  assertEqual(normalizeDomRoute(page.path), route, 'DOM page route')
  const current = await session.currentPage()
  assertEqual(current && normalizeDomRoute(current.path), route, 'DOM active route')
}

export async function captureDomCheckpoint(
  session: DomSession,
  page: DomPage,
  checkpoint: DomCheckpoint,
  provider: DomAcceptance['provider'],
  timeout = 15_000,
): Promise<DomCheckpointEvidence> {
  const deadline = Date.now() + timeout
  let lastError: unknown
  do {
    try {
      await assertRoute(session, page, checkpoint)
      const evidence: DomCheckpointEvidence = {
        id: checkpoint.id,
        route: normalizeDomRoute(checkpoint.route),
        source: provider === 'devtools' ? 'devtools-page-frame' : 'headless-logical-tree',
        capturedAt: new Date().toISOString(),
        nodes: [],
      }
      for (const expected of checkpoint.nodes) {
        // 禁止 AppService 降级把协议异常转换成空节点或数据源断言。
        let query = (selector: string) => page.$$(selector, { fallback: false, timeout: Math.max(1, deadline - Date.now()) })
        for (const scope of expected.scope ?? []) {
          let parents = await query(typeof scope === 'string' ? scope : 'component')
          if (typeof scope !== 'string') {
            const matches = []
            for (const component of parents) {
              if (!component.$$) {
                throw new Error('DOM provider cannot query component scope')
              }
              const descendants = await component.$$(scope.has, { timeout: Math.max(1, deadline - Date.now()) })
              if (descendants.length > 0) {
                matches.push(component)
              }
            }
            parents = matches
          }
          assertEqual(parents.length, 1, `DOM component scope ${JSON.stringify(scope)}`)
          const parent = parents[0]!
          if (!parent.$$) {
            throw new Error(`DOM component scope does not support node queries: ${scope}`)
          }
          const queryChildren = parent.$$.bind(parent)
          query = selector => queryChildren(selector, { timeout: Math.max(1, deadline - Date.now()) })
        }
        let elements = await query(expected.selector)
        if (expected.has) {
          const matches = []
          for (const element of elements) {
            if (!element.$$) {
              throw new Error('DOM provider cannot query component descendants')
            }
            if ((await element.$$(expected.has, { timeout: Math.max(1, deadline - Date.now()) })).length > 0) {
              matches.push(element)
            }
          }
          elements = matches
        }
        assertEqual(elements.length, expected.count ?? 1, `${expected.selector} count`)
        const nodes: DomCheckpointEvidence['nodes'][number]['nodes'] = []
        for (const element of elements) {
          const node: typeof nodes[number] = {}
          if (expected.text !== undefined) {
            node.text = (await element.text()).trim()
            assertEqual(node.text, expected.text, `${expected.selector} text`)
          }
          if (expected.attributes) {
            node.attributes = {}
            for (const [name, value] of Object.entries(expected.attributes)) {
              const readAttribute = element.attribute ?? element.attr
              if (!readAttribute) {
                throw new Error('DOM provider cannot read rendered attributes')
              }
              node.attributes[name] = await readAttribute.call(element, name)
              assertEqual(node.attributes[name], value, `${expected.selector} attribute ${name}`)
            }
          }
          if (expected.styles) {
            if (!element.style) {
              throw new Error('DOM provider cannot read computed styles')
            }
            node.styles = {}
            for (const [name, value] of Object.entries(expected.styles)) {
              node.styles[name] = await element.style(name)
              assertEqual(node.styles[name], value, `${expected.selector} style ${name}`)
            }
          }
          if (expected.visible !== undefined) {
            if (!element.size || !element.style) {
              throw new Error('DOM provider cannot read layout')
            }
            node.size = await element.size()
            const display = await element.style('display')
            const visibility = await element.style('visibility')
            const opacity = await element.style('opacity')
            node.styles = { ...node.styles, display, visibility, opacity }
            assertEqual(node.size.width > 0 && node.size.height > 0 && display !== 'none'
              && visibility !== 'hidden' && visibility !== 'collapse' && Number(opacity) > 0, expected.visible, `${expected.selector} visible`)
          }
          nodes.push(node)
        }
        evidence.nodes.push({ selector: expected.selector, has: expected.has, scope: expected.scope, count: elements.length, nodes })
      }
      await assertRoute(session, page, checkpoint)
      return evidence
    }
    catch (error) {
      if (Date.now() < deadline || !lastError) {
        lastError = error
      }
    }
    if (Date.now() < deadline) {
      await delay(Math.min(100, deadline - Date.now()))
    }
  } while (Date.now() < deadline)
  throw new Error(`DOM checkpoint ${checkpoint.id} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`, { cause: lastError })
}

export function assertDomAcceptanceComplete(plan: DomAcceptance | undefined) {
  if (!plan) {
    throw new Error('Missing DOM acceptance plan and evidence for this case')
  }
  validateDomPlan(plan)
  assertEqual(plan.evidence.map(item => item.id), plan.checkpoints.map(item => item.id), 'DOM checkpoint execution order')
  for (const [index, checkpoint] of plan.checkpoints.entries()) {
    const evidence = plan.evidence[index]!
    assertEqual(evidence.route, normalizeDomRoute(checkpoint.route), 'DOM evidence route')
    assertEqual(evidence.source, plan.provider === 'devtools' ? 'devtools-page-frame' : 'headless-logical-tree', 'DOM evidence provider')
  }
}
