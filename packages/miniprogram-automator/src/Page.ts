/**
 * @file 页面对象能力封装。
 */
import type Connection from './Connection'
import Element from './Element'
import { isFn, isNum, isStr, sleep, waitUntil } from './internal/compat'
/** IPageOptions 的类型定义。 */
export interface IPageOptions {
  id: number
  path: string
  query: any
}
type PageMap = Map<number, Page>
type WaitCondition = string | number | (() => unknown | Promise<unknown>)
interface PageQueryOptions {
  timeout?: number
}
interface PageRenderedOptions {
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
const PAGE_QUERY_TIMEOUT = 2_500
const PAGE_DATA_TIMEOUT = 12_000
const PAGE_SET_DATA_TIMEOUT = 12_000
const PAGE_CALL_METHOD_TIMEOUT = 12_000
const PAGE_CALL_METHOD_FALLBACK_RETRIES = 3
const PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY = 300
const PAGE_RENDERED_TIMEOUT = 15_000
const PAGE_RENDERED_POLL_DELAY = 220
const PAGE_RENDERED_QUERY_TIMEOUT = 5_000
const PAGE_ROOT_SELECTORS = ['page', 'body', 'weapp-app-shell', 'view'] as const
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
/** Page 的实现。 */
export default class Page {
  path = ''
  query: any = {}
  private id: number
  private elementMap = new Map<string, Element>()
  constructor(private connection: Connection, options: IPageOptions) {
    this.id = options.id
    this.path = options.path
    this.query = options.query
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
    try {
      const element = await this.send('Page.getElement', { selector }, {
        timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
      })
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    }
    catch {
      return null
    }
  }

  async $$(selector: string, options: PageQueryOptions = {}) {
    const { elements } = await this.send('Page.getElements', { selector }, {
      timeout: options.timeout ?? PAGE_QUERY_TIMEOUT,
    })
    return elements.map((element: any) => {
      return Element.create(this.connection, { ...element, pageId: this.id }, this.elementMap)
    })
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
      functionDeclaration: `function (route, query, selector) {
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
          if (scope && typeof scope.createSelectorQuery === 'function') {
            query = scope.createSelectorQuery();
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
          if (typeof query.in === 'function') {
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
            var componentSelectors = ['*', 'weapp-app-shell', 'weapp-layout-default'];
            for (var selectorIndex = 0; selectorIndex < componentSelectors.length; selectorIndex += 1) {
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
            try {
            var query = createSelectorQuery(scope);
            if (!query) {
              resolve([]);
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
                  resolve(Array.isArray(nodes) ? nodes : nodes ? [nodes] : []);
                })
                .exec();
            }
            catch (_) {
              resolve([]);
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
      args: [normalizeRoute(this.path), this.query, selector],
    }, {
      timeout: options.timeout ?? PAGE_RENDERED_QUERY_TIMEOUT,
    }) as { result?: RenderedNodeSnapshot[] }
    return Array.isArray(result) ? result : []
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
          const nodes = await this.renderedNodes(options.selector, {
            timeout: Math.min(PAGE_RENDERED_QUERY_TIMEOUT, Math.max(1, timeout - (Date.now() - start))),
          })
          lastRenderedNodes = nodes
          lastError = undefined
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

  async data(path?: string) {
    const payload: Record<string, any> = {}
    if (path) {
      payload.path = path
    }
    try {
      return (await this.send('Page.getData', payload, {
        timeout: PAGE_DATA_TIMEOUT,
      })).data
    }
    catch (error) {
      if (!isProtocolTimeoutError(error, 'Page.getData')) {
        throw error
      }
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
        timeout: PAGE_DATA_TIMEOUT,
      })).result
    }
  }

  async setData(data: any) {
    try {
      await this.send('Page.setData', { data }, {
        timeout: PAGE_SET_DATA_TIMEOUT,
      })
    }
    catch (error) {
      if (!isProtocolTimeoutError(error, 'Page.setData') && !isPageStackStaleError(error)) {
        throw error
      }
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
    try {
      const result = (await this.send('Page.callMethod', { method, args }, {
        timeout: PAGE_CALL_METHOD_TIMEOUT,
      })).result
      if (result !== undefined) {
        return result
      }
    }
    catch (error) {
      if (!isProtocolTimeoutError(error, 'Page.callMethod') && !isPageStackStaleError(error)) {
        throw error
      }
    }
    return await this.callRouteMethod(method, args)
  }

  private async callRouteMethod(method: string, args: any[]) {
    let latestResult: any
    for (let attempt = 1; attempt <= PAGE_CALL_METHOD_FALLBACK_RETRIES; attempt += 1) {
      try {
        const fallbackResult = (await this.connection.send('App.callFunction', {
          functionDeclaration: `async function (route, query, method, args) {
            var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
            var normalizedRoute = String(route || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
            function methodResult(value) {
              return {
                __weappVitePageMethodFound: true,
                value: value
              };
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
            for (var index = pages.length - 1; index >= 0; index -= 1) {
              var page = pages[index];
              var pageRoute = String(page.path || page.route || page.__route__ || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
              if (pageRoute === normalizedRoute && matchesQuery(page, query) && typeof page[method] === 'function') {
                return methodResult(await page[method].apply(page, args || []));
              }
            }
            for (var fallbackIndex = pages.length - 1; fallbackIndex >= 0; fallbackIndex -= 1) {
              var fallbackPage = pages[fallbackIndex];
              if (matchesQuery(fallbackPage, query) && typeof fallbackPage[method] === 'function') {
                return methodResult(await fallbackPage[method].apply(fallbackPage, args || []));
              }
            }
            return {
              __weappVitePageMethodFound: false
            };
          }`,
          args: [this.path, this.query, method, args],
        }, {
          timeout: PAGE_CALL_METHOD_TIMEOUT,
        })).result
        if (fallbackResult && typeof fallbackResult === 'object' && fallbackResult.__weappVitePageMethodFound === true) {
          return fallbackResult.value
        }
        latestResult = fallbackResult && typeof fallbackResult === 'object' && fallbackResult.__weappVitePageMethodFound === false
          ? undefined
          : fallbackResult
        if (latestResult !== undefined || attempt === PAGE_CALL_METHOD_FALLBACK_RETRIES) {
          return latestResult
        }
      }
      catch (error) {
        if (!isProtocolTimeoutError(error, 'App.callFunction') || attempt === PAGE_CALL_METHOD_FALLBACK_RETRIES) {
          throw error
        }
      }
      await sleep(PAGE_CALL_METHOD_FALLBACK_RETRY_DELAY)
    }
    return latestResult
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
