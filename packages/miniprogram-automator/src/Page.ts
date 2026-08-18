/**
 * @file 页面对象能力封装。
 */
import type Connection from './Connection'
import Element from './Element'
import { isFn, isNum, isStr, sleep, waitUntil } from './internal/compat'
import { createRouteFallbackElement } from './pageRouteFallback'
import { callRouteMethodViaAppService } from './pageRouteMethod'
/** IPageOptions 的类型定义。 */
export interface IPageOptions {
  id: number
  path: string
  query: any
}
type PageMap = Map<number, Page>
type WaitCondition = string | number | (() => unknown | Promise<unknown>)
interface PageQueryOptions {
  componentSelectors?: string[]
  fallback?: boolean
  routeOnly?: boolean
  timeout?: number
}
interface PageDataOptions {
  fallback?: boolean
  routeOnly?: boolean
  timeout?: number
}
interface PageCallMethodOptions {
  fallback?: boolean
  routeOnly?: boolean
  timeout?: number
}
interface PageRenderedOptions {
  componentSelectors?: string[]
  dataset?: Record<string, string | number | boolean>
  predicate?: (wxml: string) => boolean
  selector?: string
  text?: string
  timeout?: number
}
export interface RenderedNodeSnapshot {
  bottom?: number
  dataset?: Record<string, unknown>
  height?: number
  id?: string
  left?: number
  right?: number
  top?: number
  width?: number
}
export type RenderedSelectorNodesSnapshot = Record<string, RenderedNodeSnapshot[]>
const PAGE_QUERY_TIMEOUT = 2_500
const PAGE_DATA_TIMEOUT = 12_000
const PAGE_DATA_PROTOCOL_TIMEOUT = 2_500
const PAGE_SET_DATA_TIMEOUT = 12_000
const PAGE_SET_DATA_PROTOCOL_TIMEOUT = 2_500
const PAGE_CALL_METHOD_TIMEOUT = 12_000
const PAGE_CALL_METHOD_PROTOCOL_TIMEOUT = 2_500
const PAGE_CALL_METHOD_FALLBACK_RETRIES = 3
const PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY = 300
const PAGE_RENDERED_TIMEOUT = 15_000
const PAGE_RENDERED_POLL_DELAY = 220
const PAGE_RENDERED_QUERY_TIMEOUT = 5_000
const PAGE_RENDERED_EMPTY_RETRIES = 2
const PAGE_ROOT_SELECTORS = ['page', 'body', 'weapp-app-shell', 'view'] as const
const PAGE_DIRECT_RENDERED_QUERY_TIMEOUT = 800
const PAGE_DIRECT_RENDERED_MAX_SCOPES = 12
const PAGE_DIRECT_COMPONENT_SELECTORS = ['weapp-app-shell', 'weapp-layout-default'] as const
const DATASET_UPPERCASE_PATTERN = /[A-Z]/g
function isProtocolTimeoutError(error: unknown, method: string) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'DEVTOOLS_PROTOCOL_TIMEOUT'
    && 'method' in error
    && error.method === method
}
function isPageStackStaleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('page is not on top of page stack')
}
function isPageMetaMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('getPageMetaByWebviewId')
    && message.includes('rawPath')
    && message.includes('is null')
}
function isCurrentFrameTimedOutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('unexpected current frame status timedout')
    || message.includes('[loader] unexpected current frame status timedout')
}
function isRecoverablePageProtocolError(error: unknown, method: string) {
  return isProtocolTimeoutError(error, method)
    || isPageMetaMissingError(error)
    || isCurrentFrameTimedOutError(error)
}
function normalizeRoute(value: string) {
  return String(value || '').replace(/^\/+/, '').replace(/\/+$/g, '')
}
function matchesDataset(
  node: RenderedNodeSnapshot,
  expected: Record<string, string | number | boolean> | undefined,
) {
  if (!expected) {
    return true
  }
  const dataset = node.dataset ?? {}
  return Object.entries(expected).every(([key, value]) => String(dataset[key] ?? '') === String(value))
}
function toDatasetAttributeName(key: string) {
  return `data-${key.replace(DATASET_UPPERCASE_PATTERN, letter => `-${letter.toLowerCase()}`)}`
}
/** Page 的实现。 */
export default class Page {
  path = ''
  query: any = {}
  private id: number
  private elementMap = new Map<string, Element>()
  private preferAppServicePageProtocol = false
  constructor(private connection: Connection, options: IPageOptions) {
    this.id = options.id
    this.path = options.path
    this.query = options.query
    this.preferAppServicePageProtocol = connection.prefersAppServicePageProtocol
  }

  updateFromOptions(options: IPageOptions) {
    this.path = options.path
    this.query = options.query
  }

  async waitFor(condition: WaitCondition) {
    if (isNum(condition)) {
      await sleep(condition)
      return
    }
    if (isFn(condition)) {
      await waitUntil(condition)
      return
    }
    if (isStr(condition)) {
      await waitUntil(async () => (await this.$$(condition)).length > 0)
    }
  }

  async $(selector: string, options: PageQueryOptions = {}) {
    if (options.routeOnly || (options.fallback !== false && this.preferAppServicePageProtocol)) {
      return await this.queryRouteElement(selector, options)
    }
    try {
      const element = await this.send('Page.getElement', { selector }, {
        timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
      })
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    }
    catch (error) {
      if (options.fallback !== false && isRecoverablePageProtocolError(error, 'Page.getElement')) {
        this.preferAppServicePageProtocol = true
        return await this.queryRouteElement(selector, options)
      }
      return null
    }
  }

  async $$(selector: string, options: PageQueryOptions = {}) {
    if (options.routeOnly || (options.fallback !== false && this.preferAppServicePageProtocol)) {
      return await this.queryRouteElements(selector, options)
    }
    try {
      const { elements } = await this.send('Page.getElements', { selector }, {
        timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
      })
      return elements.map((element: any) => {
        return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
      })
    }
    catch (error) {
      if (options.fallback === false || !isRecoverablePageProtocolError(error, 'Page.getElements')) {
        throw error
      }
      this.preferAppServicePageProtocol = true
      return await this.queryRouteElements(selector, options)
    }
  }

  async getElementByXpath(selector: string, options: PageQueryOptions = {}) {
    try {
      const element = await this.send('Page.getElementByXpath', { selector }, {
        timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
      })
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async getElementsByXpath(selector: string, options: PageQueryOptions = {}) {
    const { elements } = await this.send('Page.getElementsByXpath', { selector }, {
      timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
    })
    return elements.map((element: any) => {
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    })
  }

  async xpath(selector: string) {
    return await this.getElementByXpath(selector)
  }

  async wxml() {
    let lastError: unknown
    for (const selector of PAGE_ROOT_SELECTORS) {
      try {
        const element = await this.$(selector, {
          timeout: PAGE_QUERY_TIMEOUT,
        })
        if (!element) {
          continue
        }
        return await element.wxml()
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to find page element')
  }

  async renderedNodes(selector: string, options: PageQueryOptions = {}): Promise<RenderedNodeSnapshot[]> {
    const { result } = await this.connection.send('App.callFunction', {
      functionDeclaration: `function (route, query, selector, scopeSelectors) {
        function normalizeRoute(value) {
          return String(value || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
        }
        function matchesQuery(page, expectedQuery) {
          if (!expectedQuery || !Object.keys(expectedQuery).length) {
            return true;
          }
          var actualQuery = page && (page.options || page.query || {});
          return Object.keys(expectedQuery).every(function (key) {
            var actualValue = String(actualQuery[key] == null ? '' : actualQuery[key]);
            var expectedValue = String(expectedQuery[key]);
            var decodedActualValue = actualValue;
            try {
              decodedActualValue = decodeURIComponent(actualValue);
            }
            catch (_) {
            }
            return actualValue === expectedValue
              || decodedActualValue === expectedValue
              || actualValue === encodeURIComponent(expectedValue);
          });
        }
        var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        var expectedRoute = normalizeRoute(route);
        var page = null;
        for (var index = pages.length - 1; index >= 0; index -= 1) {
          var candidate = pages[index];
          var candidateRoute = normalizeRoute(candidate && (candidate.path || candidate.route || candidate.__route__));
          if ((!expectedRoute || candidateRoute === expectedRoute) && matchesQuery(candidate, query)) {
            page = candidate;
            break;
          }
        }
        if (!page) {
          return [];
        }
        function createSelectorQuery(scope) {
          var query = null;
          var createdFromScope = false;
          if (scope && typeof scope.createSelectorQuery === 'function') {
            query = scope.createSelectorQuery();
            createdFromScope = true;
          }
          else if (typeof wx !== 'undefined' && wx && typeof wx.createSelectorQuery === 'function') {
            query = wx.createSelectorQuery();
          }
          else if (typeof page.createSelectorQuery === 'function') {
            query = page.createSelectorQuery();
          }
          if (!query) {
            return null;
          }
          if (!createdFromScope && typeof query.in === 'function') {
            try {
              query = query.in(scope || page);
            }
            catch (_) {
            }
          }
          return query;
        }
        function pushUnique(list, seen, item) {
          if (!item) {
            return;
          }
          var id = item.is || item.id || item.__wxWebviewId__ || item.__wxExparserNodeId__ || String(list.length);
          if (seen[id]) {
            return;
          }
          seen[id] = true;
          list.push(item);
        }
        function collectScopes(root) {
          var scopes = [];
          var seen = {};
          var queue = [];
          pushUnique(scopes, seen, root);
          queue.push(root);
          for (var queueIndex = 0; queueIndex < queue.length && queueIndex < 60; queueIndex += 1) {
            var scope = queue[queueIndex];
            if (!scope || typeof scope.selectAllComponents !== 'function') {
              continue;
            }
            var children = [];
            var componentSelectors = Array.isArray(scopeSelectors) ? scopeSelectors.slice() : [];
            componentSelectors.push(selector, '*', 'weapp-app-shell', 'weapp-layout-default');
            for (var selectorIndex = 0; selectorIndex < componentSelectors.length; selectorIndex += 1) {
              if (!componentSelectors[selectorIndex]) {
                continue;
              }
              try {
                var selected = scope.selectAllComponents(componentSelectors[selectorIndex]);
                if (Array.isArray(selected)) {
                  children = children.concat(selected);
                }
              }
              catch (_) {
              }
            }
            for (var childIndex = 0; childIndex < children.length; childIndex += 1) {
              var child = children[childIndex];
              var previousLength = scopes.length;
              pushUnique(scopes, seen, child);
              if (scopes.length > previousLength) {
                queue.push(child);
              }
            }
          }
          return scopes;
        }
        function queryScope(scope) {
          return new Promise(function (resolve) {
            var settled = false;
            var timer = setTimeout(function () {
              if (settled) {
                return;
              }
              settled = true;
              resolve([]);
            }, 800);
            function finish(nodes) {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve(Array.isArray(nodes) ? nodes : nodes ? [nodes] : []);
            }
            try {
              var query = createSelectorQuery(scope);
              if (!query) {
                finish([]);
                return;
              }
              query
                .selectAll(selector)
                .fields({
                  dataset: true,
                  id: true,
                  rect: true,
                  size: true
                }, function (nodes) {
                  finish(nodes);
                })
                .exec();
            }
            catch (_) {
              finish([]);
            }
          });
        }
        return new Promise(function (resolve) {
          try {
            var scopes = collectScopes(page);
            var collected = [];
            var index = 0;
            function next() {
              if (index >= scopes.length) {
                resolve(collected);
                return;
              }
              var scope = scopes[index];
              index += 1;
              queryScope(scope).then(function (nodes) {
                collected = collected.concat(nodes);
                if (nodes.length > 0) {
                  resolve(collected);
                  return;
                }
                next();
              }, function () {
                next();
              });
            }
            next();
          }
          catch (_) {
            resolve([]);
          }
        });
      }`,
      args: [normalizeRoute(this.path), this.query, selector, options.componentSelectors ?? []],
    }, {
      timeout: options.timeout ?? PAGE_RENDERED_QUERY_TIMEOUT,
    }) as { result?: RenderedNodeSnapshot[] }
    return Array.isArray(result) ? result : []
  }

  async renderedSelectorNodes(
    selectors: string[],
    options: PageQueryOptions = {},
  ): Promise<RenderedSelectorNodesSnapshot> {
    const normalizedSelectors = selectors
      .map(selector => String(selector || '').trim())
      .filter(Boolean)
    if (normalizedSelectors.length === 0) {
      return {}
    }

    const { result } = await this.connection.send('App.callFunction', {
      functionDeclaration: `function (route, query, selectors, scopeSelectors) {
        function normalizeRoute(value) {
          return String(value || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
        }
        function matchesQuery(page, expectedQuery) {
          if (!expectedQuery || !Object.keys(expectedQuery).length) {
            return true;
          }
          var actualQuery = page && (page.options || page.query || {});
          return Object.keys(expectedQuery).every(function (key) {
            var actualValue = String(actualQuery[key] == null ? '' : actualQuery[key]);
            var expectedValue = String(expectedQuery[key]);
            var decodedActualValue = actualValue;
            try {
              decodedActualValue = decodeURIComponent(actualValue);
            }
            catch (_) {
            }
            return actualValue === expectedValue
              || decodedActualValue === expectedValue
              || actualValue === encodeURIComponent(expectedValue);
          });
        }
        function createSelectorQuery(scope, page) {
          var query = null;
          var createdFromScope = false;
          if (scope && typeof scope.createSelectorQuery === 'function') {
            query = scope.createSelectorQuery();
            createdFromScope = true;
          }
          else if (typeof wx !== 'undefined' && wx && typeof wx.createSelectorQuery === 'function') {
            query = wx.createSelectorQuery();
          }
          else if (page && typeof page.createSelectorQuery === 'function') {
            query = page.createSelectorQuery();
          }
          if (!query) {
            return null;
          }
          if (!createdFromScope && typeof query.in === 'function') {
            try {
              query = query.in(scope || page);
            }
            catch (_) {
            }
          }
          return query;
        }
        function pushUnique(list, seen, item) {
          if (!item) {
            return;
          }
          var id = item.is || item.id || item.__wxWebviewId__ || item.__wxExparserNodeId__ || String(list.length);
          if (seen[id]) {
            return;
          }
          seen[id] = true;
          list.push(item);
        }
        function collectScopes(root, selectorList) {
          var scopes = [];
          var seen = {};
          var queue = [];
          pushUnique(scopes, seen, root);
          queue.push(root);
          for (var queueIndex = 0; queueIndex < queue.length && queueIndex < 30; queueIndex += 1) {
            var scope = queue[queueIndex];
            if (!scope || typeof scope.selectAllComponents !== 'function') {
              continue;
            }
            var children = [];
            var componentSelectors = Array.isArray(scopeSelectors) ? scopeSelectors.slice() : [];
            for (var selectorIndex = 0; selectorIndex < selectorList.length; selectorIndex += 1) {
              componentSelectors.push(selectorList[selectorIndex]);
            }
            componentSelectors.push('*', 'weapp-app-shell', 'weapp-layout-default');
            for (var componentIndex = 0; componentIndex < componentSelectors.length; componentIndex += 1) {
              if (!componentSelectors[componentIndex]) {
                continue;
              }
              try {
                var selected = scope.selectAllComponents(componentSelectors[componentIndex]);
                if (Array.isArray(selected)) {
                  children = children.concat(selected);
                }
              }
              catch (_) {
              }
            }
            for (var childIndex = 0; childIndex < children.length; childIndex += 1) {
              var child = children[childIndex];
              var previousLength = scopes.length;
              pushUnique(scopes, seen, child);
              if (scopes.length > previousLength) {
                queue.push(child);
              }
            }
          }
          return scopes;
        }
        function queryScope(scope, page, selector) {
          return new Promise(function (resolve) {
            var settled = false;
            var timer = setTimeout(function () {
              if (settled) {
                return;
              }
              settled = true;
              resolve([]);
            }, 450);
            function finish(nodes) {
              if (settled) {
                return;
              }
              settled = true;
              clearTimeout(timer);
              resolve(Array.isArray(nodes) ? nodes : nodes ? [nodes] : []);
            }
            try {
              var query = createSelectorQuery(scope, page);
              if (!query) {
                finish([]);
                return;
              }
              query
                .selectAll(selector)
                .fields({
                  dataset: true,
                  id: true,
                  rect: true,
                  size: true
                }, function (nodes) {
                  finish(nodes);
                })
                .exec();
            }
            catch (_) {
              finish([]);
            }
          });
        }
        var selectorList = Array.isArray(selectors)
          ? selectors.map(function (selector) {
            return String(selector || '').trim();
          }).filter(Boolean)
          : [];
        if (!selectorList.length) {
          return {};
        }
        var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
        var expectedRoute = normalizeRoute(route);
        var page = null;
        for (var index = pages.length - 1; index >= 0; index -= 1) {
          var candidate = pages[index];
          var candidateRoute = normalizeRoute(candidate && (candidate.path || candidate.route || candidate.__route__));
          if ((!expectedRoute || candidateRoute === expectedRoute) && matchesQuery(candidate, query)) {
            page = candidate;
            break;
          }
        }
        if (!page) {
          return {};
        }
        return new Promise(function (resolve) {
          try {
            var result = {};
            var scopes = collectScopes(page, selectorList);
            var startedAt = Date.now();
            var maxQueries = 40;
            var queryCount = 0;
            var selectorIndex = 0;
            var scopeIndex = 0;
            function next() {
              if (selectorIndex >= selectorList.length || queryCount >= maxQueries || Date.now() - startedAt > 1800) {
                resolve(result);
                return;
              }
              var selector = selectorList[selectorIndex];
              if (scopeIndex >= scopes.length) {
                selectorIndex += 1;
                scopeIndex = 0;
                next();
                return;
              }
              var scope = scopes[scopeIndex];
              scopeIndex += 1;
              queryCount += 1;
              queryScope(scope, page, selector).then(function (nodes) {
                if (Array.isArray(nodes) && nodes.length > 0) {
                  result[selector] = (result[selector] || []).concat(nodes);
                  selectorIndex += 1;
                  scopeIndex = 0;
                }
                next();
              }, function () {
                next();
              });
            }
            next();
          }
          catch (_) {
            resolve({});
          }
        });
      }`,
      args: [normalizeRoute(this.path), this.query, normalizedSelectors, options.componentSelectors ?? []],
    }, {
      timeout: options.timeout ?? PAGE_RENDERED_QUERY_TIMEOUT,
    }) as { result?: RenderedSelectorNodesSnapshot }
    return result && typeof result === 'object' && !Array.isArray(result) ? result : {}
  }

  async waitForRendered(options: PageRenderedOptions = {}) {
    const timeout = options.timeout ?? PAGE_RENDERED_TIMEOUT
    const start = Date.now()
    let lastWxml = ''
    let lastRenderedNodes: RenderedNodeSnapshot[] = []
    let lastError: unknown
    while (Date.now() - start <= timeout) {
      try {
        if (options.selector) {
          const remaining = Math.max(1, timeout - (Date.now() - start))
          let directNode: RenderedNodeSnapshot | null = null
          if (!this.preferAppServicePageProtocol) {
            try {
              directNode = await this.readDirectRenderedNode(
                options.selector,
                options.dataset,
                Math.max(1, Math.floor(remaining / 2)),
                options.componentSelectors,
              )
            }
            catch (error) {
              lastError = error
            }
          }
          if (directNode && matchesDataset(directNode, options.dataset)) {
            return JSON.stringify({
              selector: options.selector,
              nodes: [directNode],
            })
          }

          let nodes: RenderedNodeSnapshot[] = []
          try {
            nodes = await this.renderedNodes(options.selector, {
              componentSelectors: options.componentSelectors,
              timeout: Math.min(PAGE_RENDERED_QUERY_TIMEOUT, Math.max(1, timeout - (Date.now() - start))),
            })
            lastError = undefined
          }
          catch (error) {
            lastError = error
          }
          lastRenderedNodes = nodes
          const matchedNode = nodes.find(node => matchesDataset(node, options.dataset))
          if (matchedNode) {
            return JSON.stringify({
              selector: options.selector,
              nodes,
            })
          }
        }
        else {
          const wxml = await this.wxml()
          lastWxml = wxml
          lastError = undefined
          const normalized = wxml.trim()
          if (options.predicate?.(wxml)) {
            return wxml
          }
          if (options.text && normalized.includes(options.text)) {
            return wxml
          }
          if (!options.text && !options.predicate && normalized && normalized !== '<text></text>') {
            return wxml
          }
        }
      }
      catch (error) {
        lastError = error
      }
      await sleep(PAGE_RENDERED_POLL_DELAY)
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')
    const expected = options.selector
      ? ` selector=${options.selector} dataset=${JSON.stringify(options.dataset ?? {})}`
      : options.text
        ? ` text=${options.text}`
        : options.predicate
          ? ' predicate=true'
          : ' non-empty wxml'
    const latest = options.selector ? JSON.stringify(lastRenderedNodes).slice(0, 500) : lastWxml.slice(0, 500)
    throw new Error(`Timed out waiting page rendered:${expected}; reason=${reason}; latest=${latest}`)
  }

  private async readDirectRenderedNode(
    selector: string,
    expectedDataset: Record<string, string | number | boolean> | undefined,
    timeout: number,
    componentSelectors: string[] | undefined,
  ): Promise<RenderedNodeSnapshot | null> {
    const element = await this.findDirectRenderedElement(selector, timeout, componentSelectors)
    if (!element) {
      return null
    }
    const entries = await Promise.all(Object.keys(expectedDataset ?? {}).map(async key => [
      key,
      await element.attribute(toDatasetAttributeName(key)),
    ] as const))
    return {
      dataset: Object.fromEntries(entries),
    }
  }

  private async findDirectRenderedElement(
    selector: string,
    timeout: number,
    componentSelectors: string[] | undefined,
  ) {
    const start = Date.now()
    const getQueryTimeout = () => Math.min(
      PAGE_DIRECT_RENDERED_QUERY_TIMEOUT,
      Math.max(1, timeout - (Date.now() - start)),
    )
    const directElement = await this.$(selector, {
      fallback: false,
      timeout: getQueryTimeout(),
    })
    if (directElement) {
      return directElement
    }

    const scopeSelectors = [...new Set([
      ...(componentSelectors ?? []),
      ...PAGE_DIRECT_COMPONENT_SELECTORS,
    ].filter(Boolean))]
    for (const rootSelector of PAGE_ROOT_SELECTORS) {
      if (Date.now() - start >= timeout) {
        break
      }
      const rootElement = await this.$(rootSelector, {
        fallback: false,
        timeout: getQueryTimeout(),
      })
      if (!rootElement) {
        continue
      }

      const queue = [rootElement]
      const visited = new Set<Element>()
      while (queue.length > 0 && visited.size < PAGE_DIRECT_RENDERED_MAX_SCOPES) {
        if (Date.now() - start >= timeout) {
          return null
        }
        const scope = queue.shift()!
        if (visited.has(scope)) {
          continue
        }
        visited.add(scope)
        const nestedElement = await scope.$(selector, {
          timeout: getQueryTimeout(),
        })
        if (nestedElement) {
          return nestedElement
        }
        for (const componentSelector of scopeSelectors) {
          const childScope = await scope.$(componentSelector, {
            timeout: getQueryTimeout(),
          })
          if (childScope && !visited.has(childScope)) {
            queue.push(childScope)
          }
        }
      }
    }
    return null
  }

  async data(path?: string, options: PageDataOptions = {}) {
    const payload: Record<string, any> = {}
    if (path) {
      payload.path = path
    }
    const timeout = options.timeout ?? PAGE_DATA_TIMEOUT
    if (options.routeOnly || (options.fallback !== false && this.preferAppServicePageProtocol)) {
      return await this.readRouteData(path, timeout)
    }
    try {
      return (await this.send('Page.getData', payload, {
        timeout: Math.min(timeout, PAGE_DATA_PROTOCOL_TIMEOUT),
      })).data
    }
    catch (error) {
      if (options.fallback === false) {
        throw error
      }
      if (!isRecoverablePageProtocolError(error, 'Page.getData')) {
        throw error
      }
      this.preferAppServicePageProtocol = true
      return await this.readRouteData(path, timeout)
    }
  }

  private async readRouteData(path: string | undefined, timeout: number) {
    return (await this.connection.send('App.callFunction', {
      functionDeclaration: `function (route, query, dataPath) {
            function normalizeRoute(value) {
              return String(value || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
            }
            function matchesQuery(page, expectedQuery) {
              if (!expectedQuery || !Object.keys(expectedQuery).length) {
                return true;
              }
              var actualQuery = page && (page.options || page.query || {});
              return Object.keys(expectedQuery).every(function (key) {
                var actualValue = String(actualQuery[key] == null ? '' : actualQuery[key]);
                var expectedValue = String(expectedQuery[key]);
                var decodedActualValue = actualValue;
                try {
                  decodedActualValue = decodeURIComponent(actualValue);
                }
                catch (_) {
                }
                return actualValue === expectedValue
                  || decodedActualValue === expectedValue
                  || actualValue === encodeURIComponent(expectedValue);
              });
            }
            function readPath(data, path) {
              if (!path) {
                return data;
            }
            if (data && Object.prototype.hasOwnProperty.call(data, path)) {
              return data[path];
            }
            return String(path).replace(/\\[(\\d+)\\]/g, '.$1').split('.').filter(Boolean).reduce(function (current, segment) {
              return current == null ? undefined : current[segment];
            }, data);
          }
          var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
          var normalizedRoute = normalizeRoute(route);
          for (var index = pages.length - 1; index >= 0; index -= 1) {
            var page = pages[index];
            var pageRoute = normalizeRoute(page.path || page.route || page.__route__);
            if (pageRoute === normalizedRoute && matchesQuery(page, query)) {
              return readPath(page.data || {}, dataPath);
            }
          }
          return undefined;
        }`,
      args: [this.path, this.query, path],
    }, {
      timeout,
    })).result
  }

  async setData(data: any) {
    if (this.preferAppServicePageProtocol) {
      await this.setRouteData(data)
      return
    }
    try {
      await this.send('Page.setData', { data }, {
        timeout: PAGE_SET_DATA_PROTOCOL_TIMEOUT,
      })
    }
    catch (error) {
      if (!isRecoverablePageProtocolError(error, 'Page.setData') && !isPageStackStaleError(error)) {
        throw error
      }
      this.preferAppServicePageProtocol = true
      await this.setRouteData(data)
    }
  }

  async size() {
    const [width, height] = await this.windowProperty([
      'document.documentElement.scrollWidth',
      'document.documentElement.scrollHeight',
    ])
    return { width, height }
  }

  async callMethod(method: string, ...args: any[]) {
    return await this.callMethodWithOptions(method, {}, ...args)
  }

  async callMethodWithOptions(method: string, options: PageCallMethodOptions = {}, ...args: any[]) {
    if (options.routeOnly || (options.fallback !== false && this.preferAppServicePageProtocol)) {
      return await this.callRouteMethod(method, args, options.timeout)
    }
    try {
      return (await this.send('Page.callMethod', { method, args }, {
        timeout: options.timeout ?? PAGE_CALL_METHOD_PROTOCOL_TIMEOUT,
      })).result
    }
    catch (error) {
      if (options.fallback === false) {
        throw error
      }
      if (!isRecoverablePageProtocolError(error, 'Page.callMethod') && !isPageStackStaleError(error)) {
        throw error
      }
      this.preferAppServicePageProtocol = true
    }
    return await this.callRouteMethod(method, args, options.timeout)
  }

  private async queryRouteElement(selector: string, options: PageQueryOptions) {
    const elements = await this.queryRouteElements(selector, options)
    return elements[0] ?? null
  }

  private async queryRouteElements(selector: string, options: PageQueryOptions) {
    const timeout = options.timeout ?? PAGE_QUERY_TIMEOUT
    const startedAt = Date.now()
    let nodes: RenderedNodeSnapshot[] = []
    for (let attempt = 0; attempt <= PAGE_RENDERED_EMPTY_RETRIES; attempt += 1) {
      const requestTimeout = attempt === 0
        ? timeout
        : Math.max(1, timeout - (Date.now() - startedAt))
      nodes = await this.renderedNodes(selector, {
        componentSelectors: options.componentSelectors,
        timeout: requestTimeout,
      })
      if (nodes.length > 0 || attempt === PAGE_RENDERED_EMPTY_RETRIES) {
        break
      }
      const remaining = timeout - (Date.now() - startedAt)
      if (remaining <= 0) {
        break
      }
      await sleep(Math.min(PAGE_RENDERED_POLL_DELAY, remaining))
    }
    return nodes.map((node, index) => createRouteFallbackElement(
      this.connection,
      this.elementMap,
      this.id,
      selector,
      node,
      index,
      this.path,
      this.query,
      options.componentSelectors,
    ))
  }

  private async callRouteMethod(method: string, args: any[], timeout = PAGE_CALL_METHOD_TIMEOUT) {
    return await callRouteMethodViaAppService(
      this.connection,
      this.path,
      this.query,
      method,
      args,
      timeout,
    )
  }

  private async setRouteData(data: any) {
    for (let attempt = 1; attempt <= PAGE_CALL_METHOD_FALLBACK_RETRIES; attempt += 1) {
      try {
        await this.connection.send('App.callFunction', {
          functionDeclaration: `function (route, query, data) {
            var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
            var normalizedRoute = String(route || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
            function matchesQuery(page, expectedQuery) {
              if (!expectedQuery || !Object.keys(expectedQuery).length) {
                return true;
              }
              var actualQuery = page && (page.options || page.query || {});
              return Object.keys(expectedQuery).every(function (key) {
                var actualValue = String(actualQuery[key] == null ? '' : actualQuery[key]);
                var expectedValue = String(expectedQuery[key]);
                var decodedActualValue = actualValue;
                try {
                  decodedActualValue = decodeURIComponent(actualValue);
                }
                catch (_) {
                }
                return actualValue === expectedValue
                  || decodedActualValue === expectedValue
                  || actualValue === encodeURIComponent(expectedValue);
              });
            }
            for (var index = pages.length - 1; index >= 0; index -= 1) {
              var page = pages[index];
              var pageRoute = String(page.path || page.route || page.__route__ || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
              if (pageRoute === normalizedRoute && matchesQuery(page, query) && typeof page.setData === 'function') {
                page.setData(data || {});
                return true;
              }
            }
            return false;
          }`,
          args: [this.path, this.query, data],
        }, {
          timeout: PAGE_SET_DATA_TIMEOUT,
        })
        return
      }
      catch (error) {
        if (!isProtocolTimeoutError(error, 'App.callFunction') || attempt === PAGE_CALL_METHOD_FALLBACK_RETRIES) {
          throw error
        }
      }
      await sleep(PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY)
    }
  }

  async scrollTop() {
    const bodyScrollTop = await this.windowProperty('document.body.scrollTop')
    const documentScrollTop = await this.windowProperty('document.documentElement.scrollTop')
    return bodyScrollTop || documentScrollTop
  }

  private async windowProperty(name: string | string[]) {
    const names = isStr(name) ? [name] : name
    const properties = (await this.send('Page.getWindowProperties', { names })).properties
    return isStr(name) ? properties[0] : properties
  }

  private async send(method: string, params: Record<string, any> = {}, options?: { timeout?: number }) {
    params.pageId = this.id
    return options
      ? await this.connection.send(method, params, options)
      : await this.connection.send(method, params)
  }

  static create(connection: Connection, options: IPageOptions, pageMap: PageMap) {
    const existing = pageMap.get(options.id)
    if (existing) {
      existing.updateFromOptions(options)
      return existing
    }
    const page = new Page(connection, options)
    pageMap.set(options.id, page)
    return page
  }
}
