/**
 * @file 页面 route 降级元素的只读快照读取(rect/size/dataset/computedStyle)。
 *
 * 背景:部分 DevTools 版本(如 2.01.2510290)的 page-frame 定向协议失效,
 * `Element.getDOMProperties`/`Element.getOffset` 等 RPC 全部超时。本模块复用
 * route 降级思路,把只读信息经 `App.callFunction` + `wx.createSelectorQuery`
 * 在 AppService 内实时取回——每次读取都重新查询,避免滚动/重渲染后拿到过期快照。
 */
import type Connection from './Connection'

/** 降级元素只读快照(rect 字段平铺在节点上;computedStyle 按请求的属性名平铺)。 */
export interface RouteElementSnapshot {
  bottom?: number
  dataset?: Record<string, unknown>
  height?: number
  id?: string
  left?: number
  right?: number
  top?: number
  width?: number
  [styleName: string]: unknown
}

const ROUTE_ELEMENT_SNAPSHOT_TIMEOUT = 5_000

/**
 * 页面定位 + 组件作用域遍历逻辑与 Page.renderedNodes 保持一致:
 * 先按 route/query 找到目标页面,再逐层进入自定义组件作用域查询,
 * 返回首个命中作用域里 selectAll(selector)[index] 的快照;未命中返回 null。
 */
const ROUTE_ELEMENT_SNAPSHOT_FUNCTION_DECLARATION = `function (route, query, selector, index, styleNames) {
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
  for (var pageIndex = pages.length - 1; pageIndex >= 0; pageIndex -= 1) {
    var candidate = pages[pageIndex];
    var candidateRoute = normalizeRoute(candidate && (candidate.path || candidate.route || candidate.__route__));
    if ((!expectedRoute || candidateRoute === expectedRoute) && matchesQuery(candidate, query)) {
      page = candidate;
      break;
    }
  }
  if (!page) {
    return null;
  }
  function createSelectorQuery(scope) {
    var selectorQuery = null;
    var createdFromScope = false;
    if (scope && typeof scope.createSelectorQuery === 'function') {
      selectorQuery = scope.createSelectorQuery();
      createdFromScope = true;
    }
    else if (typeof wx !== 'undefined' && wx && typeof wx.createSelectorQuery === 'function') {
      selectorQuery = wx.createSelectorQuery();
    }
    else if (typeof page.createSelectorQuery === 'function') {
      selectorQuery = page.createSelectorQuery();
    }
    if (!selectorQuery) {
      return null;
    }
    if (!createdFromScope && typeof selectorQuery.in === 'function') {
      try {
        selectorQuery = selectorQuery.in(scope || page);
      }
      catch (_) {
      }
    }
    return selectorQuery;
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
      var componentSelectors = [selector, '*', 'weapp-app-shell', 'weapp-layout-default'];
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
        var selectorQuery = createSelectorQuery(scope);
        if (!selectorQuery) {
          finish([]);
          return;
        }
        selectorQuery
          .selectAll(selector)
          .fields({
            id: true,
            dataset: true,
            rect: true,
            size: true,
            computedStyle: Array.isArray(styleNames) ? styleNames : []
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
      var scopeIndex = 0;
      function next() {
        if (scopeIndex >= scopes.length) {
          resolve(null);
          return;
        }
        var scope = scopes[scopeIndex];
        scopeIndex += 1;
        queryScope(scope).then(function (nodes) {
          if (nodes.length > 0) {
            resolve(nodes[index] || null);
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
      resolve(null);
    }
  });
}`

/**
 * 读取降级元素快照。未找到(页面不在/选择器无命中/索引越界)返回 null,
 * 由调用方决定抛错文案;永不因为协议失效而长时间挂起。
 */
export async function readRouteElementSnapshot(
  connection: Connection,
  route: string,
  query: Record<string, any>,
  selector: string,
  index: number,
  styleNames: string[] = [],
  timeout = ROUTE_ELEMENT_SNAPSHOT_TIMEOUT,
): Promise<RouteElementSnapshot | null> {
  const { result } = await connection.send('App.callFunction', {
    functionDeclaration: ROUTE_ELEMENT_SNAPSHOT_FUNCTION_DECLARATION,
    args: [route, query, selector, index, styleNames],
  }, {
    timeout,
  }) as { result?: RouteElementSnapshot | null }
  return result ?? null
}
