import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
} from '@weapp-core/constants'

export interface StatefulHmrControl {
  buildId: string
  token: string
  url: string
}

export const statefulHmrRolldownRuntimeSource = `
var BaseDevRuntime = DevRuntime;
class WeappViteHotContext {
  callbacks = [];
  data = {};
  _internal = { updateStyle() {}, removeStyle() {} };
  constructor(moduleId) { this.moduleId = moduleId; }
  accept(...args) {
    if (args.length === 0) this.callbacks.push({ deps: this.moduleId, callback: undefined });
    else if (args.length === 1 && typeof args[0] === 'function') this.callbacks.push({ deps: this.moduleId, callback: args[0] });
    else if (args.length === 1) this.callbacks.push({ deps: args[0], callback: undefined });
    else this.callbacks.push({ deps: args[0], callback: args[1] });
  }
  acceptExports(_exports, callback) { this.accept(callback); }
  dispose() {}
  prune() {}
  invalidate() {}
  on() {}
  off() {}
  send() {}
}
class WeappViteDevRuntime extends BaseDevRuntime {
  contexts = new Map();
  patchedModules = new Set();
  applyingPatch = false;
  currentModuleId = '';
  registrationModuleId = '';
  createEsmInitializer = (id, initialize, _deduplicate, result) => () => {
    if (!initialize) return result;
    const callback = initialize;
    initialize = undefined;
    const previousId = this.currentModuleId;
    this.currentModuleId = id;
    try { result = callback(id); }
    finally { this.currentModuleId = previousId; }
    if (this.applyingPatch) this.patchedModules.add(id);
    return result;
  };
  createCjsInitializer = (id, initialize, _deduplicate, module) => () => {
    if (module) return module.exports;
    module = { exports: {} };
    const previousId = this.currentModuleId;
    this.currentModuleId = id;
    try { initialize(module.exports, module, id); }
    finally { this.currentModuleId = previousId; }
    if (this.applyingPatch) this.patchedModules.add(id);
    return module.exports;
  };
  createModuleHotContext(moduleId) {
    const previous = this.contexts.get(moduleId);
    const context = new WeappViteHotContext(moduleId);
    this.registrationModuleId = moduleId;
    if (previous) {
      context.callbacks = previous.callbacks;
      context.data = previous.data;
    }
    this.contexts.set(moduleId, context);
    return context;
  }
  registerModule(id, exportsHolder) {
    this.registrationModuleId = id;
    return super.registerModule(id, exportsHolder);
  }
  initModule(id) {
    const previousId = this.currentModuleId;
    this.currentModuleId = id;
    try {
      const result = super.initModule(id);
      if (this.applyingPatch) this.patchedModules.add(id);
      return result;
    }
    finally { this.currentModuleId = previousId; }
  }
  beginPatch() { this.applyingPatch = true; }
  endPatch() { this.applyingPatch = false; }
  applyUpdates(boundaries) {
    for (const [boundary, acceptedVia] of boundaries) {
      const context = this.contexts.get(boundary);
      if (!context) continue;
      const callbacks = [...context.callbacks];
      if (boundary === acceptedVia) context.callbacks = [];
      for (const { deps, callback } of callbacks) {
        if (!callback) continue;
        if (Array.isArray(deps)) {
          if (deps.includes(acceptedVia)) callback(deps.map((id) => this.loadExports(id)));
        } else if (deps === acceptedVia) callback(this.loadExports(acceptedVia));
      }
    }
  }
}
const runtime = new WeappViteDevRuntime(undefined, 'weapp-vite-stateful');
globalThis.__rolldown_runtime__ = runtime;
const bridgeKey = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)};
const definitions = new Map();
const registered = new Set();
const instances = new Map();
const instanceSnapshots = new WeakMap();
const moduleSnapshots = new Map();
const pendingNativeDefinitions = new Map();
const wevuRefreshes = new Map();
const wevuRefreshGenerations = new Map();
const wevuInstanceGenerations = new WeakMap();
let suppressLifecycles = false;
const nativeRegistrations = {};
function getInstances(moduleId) {
  let values = instances.get(moduleId);
  if (!values) instances.set(moduleId, values = new Set());
  return values;
}
function cloneInstanceData(value) {
  if (Array.isArray(value)) return value.map(cloneInstanceData);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) result[key] = cloneInstanceData(child);
  return result;
}
function countChangedDataKeys(data, initialData) {
  let changed = 0;
  for (const [key, value] of Object.entries(data)) {
    if (!Object.prototype.hasOwnProperty.call(initialData, key)) {
      changed++;
      continue;
    }
    try {
      if (JSON.stringify(value) !== JSON.stringify(initialData[key])) changed++;
    } catch {
      if (value !== initialData[key]) changed++;
    }
  }
  return changed;
}
function rememberInstanceState(instance, moduleId) {
  if (!instance?.data || typeof instance.data !== 'object') return;
  const data = cloneInstanceData(instance.data);
  const definitionData = definitions.get(moduleId)?.data;
  const initialData = definitionData && typeof definitionData === 'object' ? definitionData : {};
  const changedKeys = countChangedDataKeys(data, initialData);
  const previous = instanceSnapshots.get(instance) || moduleSnapshots.get(moduleId);
  if (!previous || changedKeys >= previous.changedKeys) {
    const snapshot = { changedKeys, data, moduleId };
    instanceSnapshots.set(instance, snapshot);
    moduleSnapshots.set(moduleId, snapshot);
  }
}
function trackInstance(instance, moduleId) {
  getInstances(moduleId).add(instance);
  if (instanceSnapshots.has(instance)) return;
  if ((wevuRefreshGenerations.get(moduleId) || 0) > 0) {
    rememberInstanceState(instance, moduleId);
    return;
  }
  const snapshot = moduleSnapshots.get(moduleId);
  if (snapshot) {
    instanceSnapshots.set(instance, snapshot);
    restoreInstanceState(instance, moduleId);
  } else {
    rememberInstanceState(instance, moduleId);
  }
}
function forgetInstance(instance, moduleId) {
  getInstances(moduleId).delete(instance);
  instanceSnapshots.delete(instance);
  if (!suppressLifecycles) moduleSnapshots.delete(moduleId);
}
function restoreInstanceState(instance, moduleId) {
  const snapshot = instanceSnapshots.get(instance);
  if (!snapshot || snapshot.moduleId !== moduleId) return;
  const data = cloneInstanceData(snapshot.data);
  if (instance.data && typeof instance.data === 'object') Object.assign(instance.data, data);
  if (typeof instance.setData === 'function') instance.setData(data);
}
function rememberTrackedInstances() {
  for (const [moduleId, values] of instances) {
    for (const instance of values) rememberInstanceState(instance, moduleId);
  }
}
function restoreTrackedInstances() {
  for (const [moduleId, values] of instances) {
    for (const instance of values) {
      const generation = wevuRefreshGenerations.get(moduleId) || 0;
      if (generation > 0 && wevuInstanceGenerations.get(instance)?.get(moduleId) === generation) continue;
      restoreInstanceState(instance, moduleId);
    }
  }
}
function refreshWevuInstance(instance, moduleId) {
  if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) return;
  const generation = wevuRefreshGenerations.get(moduleId) || 0;
  if (generation === 0) return;
  let generations = wevuInstanceGenerations.get(instance);
  if (generations?.get(moduleId) === generation) return;
  const refresh = wevuRefreshes.get(moduleId);
  if (typeof refresh !== 'function') return;
  restoreInstanceState(instance, moduleId);
  const snapshot = instanceSnapshots.get(instance) || moduleSnapshots.get(moduleId);
  refresh(instance, cloneInstanceData(snapshot?.data));
  rememberInstanceState(instance, moduleId);
  if (!generations) wevuInstanceGenerations.set(instance, generations = new Map());
  generations.set(moduleId, generation);
}
function proxyFunction(moduleId, path, fallback) {
  return function (...args) {
    if (suppressLifecycles && /(?:created|attached|ready|detached|onLoad|onShow|onHide|onUnload)$/.test(path)) return;
    const definition = definitions.get(moduleId);
    const segments = path.split('.');
    let value = definition;
    for (const segment of segments) value = value && value[segment];
    trackInstance(this, moduleId);
    try {
      return (typeof value === 'function' ? value : fallback)?.apply(this, args);
    } finally {
      rememberInstanceState(this, moduleId);
    }
  };
}
function decorateObject(value, moduleId, prefix = '', trackLifecycle = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...value };
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? prefix + '.' + key : key;
    if (typeof child === 'function') result[key] = proxyFunction(moduleId, path, child);
    else if (child && typeof child === 'object' && ['lifetimes', 'methods', 'pageLifetimes'].includes(key)) {
      result[key] = decorateObject(child, moduleId, path);
    }
  }
  if (!prefix && typeof value.onLoad === 'function') {
    const onLoad = result.onLoad;
    result.onLoad = function (...args) {
      trackInstance(this, moduleId);
      return onLoad.apply(this, args);
    };
  }
  if (!prefix && (trackLifecycle || (result.lifetimes && typeof result.lifetimes === 'object'))) {
    const lifetimes = { ...(result.lifetimes || {}) };
    const attached = lifetimes.attached;
    const detached = lifetimes.detached;
    result.lifetimes = lifetimes;
    if (trackLifecycle || typeof attached === 'function') {
      result.lifetimes.attached = function (...args) {
        trackInstance(this, moduleId);
        return attached?.apply(this, args);
      };
    }
    if (trackLifecycle || typeof detached === 'function') {
      result.lifetimes.detached = function (...args) {
        try {
          return detached?.apply(this, args);
        } finally {
          forgetInstance(this, moduleId);
        }
      };
    }
  }
  return result;
}
function decorateWevuComponent(definition, moduleId) {
  const result = { ...definition };
  const resolveWevuDefinition = () => definitions.get(moduleId) || definition;
  const callLatestWevuFunction = (instance, path, fallback, args) => {
    const segments = path.split('.');
    let value = resolveWevuDefinition();
    for (const segment of segments) value = value && value[segment];
    return (typeof value === 'function' ? value : fallback)?.apply(instance, args);
  };
  const methods = { ...(definition.methods || {}) };
  for (const name of Object.keys(methods)) {
    const fallback = methods[name];
    if (typeof fallback !== 'function') continue;
    methods[name] = function (...args) {
      trackInstance(this, moduleId);
      refreshWevuInstance(this, moduleId);
      try {
        return callLatestWevuFunction(this, 'methods.' + name, fallback, args);
      } finally {
        rememberInstanceState(this, moduleId);
      }
    };
  }
  result.methods = methods;
  const pageHookNames = ['onLoad', 'onShow', 'onReady', 'onHide', 'onResize', 'onUnload', 'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage', 'onShareTimeline', 'onAddToFavorites'];
  for (const name of pageHookNames) {
    const fallback = result[name];
    if (typeof fallback !== 'function') continue;
    result[name] = function (...args) {
      trackInstance(this, moduleId);
      refreshWevuInstance(this, moduleId);
      if (suppressLifecycles && /^(?:onLoad|onShow|onHide|onUnload)$/.test(name)) return;
      try {
        return callLatestWevuFunction(this, name, fallback, args);
      } finally {
        rememberInstanceState(this, moduleId);
        if (name === 'onUnload') forgetInstance(this, moduleId);
      }
    };
  }
  const lifetimes = { ...(definition.lifetimes || {}) };
  for (const name of Object.keys(lifetimes)) {
    const fallback = lifetimes[name];
    if (typeof fallback !== 'function') continue;
    lifetimes[name] = function (...args) {
      if (suppressLifecycles) return;
      if (name === 'created' || name === 'attached') {
        trackInstance(this, moduleId);
        refreshWevuInstance(this, moduleId);
      }
      try {
        return callLatestWevuFunction(this, 'lifetimes.' + name, fallback, args);
      } finally {
        if (name === 'detached') forgetInstance(this, moduleId);
      }
    };
  }
  const pageLifetimes = { ...(definition.pageLifetimes || {}) };
  for (const name of Object.keys(pageLifetimes)) {
    const fallback = pageLifetimes[name];
    if (typeof fallback !== 'function') continue;
    pageLifetimes[name] = function (...args) {
      trackInstance(this, moduleId);
      refreshWevuInstance(this, moduleId);
      try {
        return callLatestWevuFunction(this, 'pageLifetimes.' + name, fallback, args);
      } finally {
        rememberInstanceState(this, moduleId);
      }
    };
  }
  return { ...result, lifetimes, pageLifetimes };
}
function registerDefinition(name, definition, nativeRegistration) {
  const moduleId = runtime.currentModuleId || runtime.registrationModuleId || name;
  if (!runtime.applyingPatch && runtime.patchedModules.has(moduleId)) return;
  if (!wevuRefreshes.has(moduleId)) definitions.set(moduleId, definition);
  if (registered.has(moduleId)) {
    return;
  }
  if (name === 'Component') {
    let pending = pendingNativeDefinitions.get(name);
    if (!pending) pendingNativeDefinitions.set(name, pending = []);
    pending.push(decorateObject(definition, moduleId, '', true));
    registered.add(moduleId);
    return;
  }
  const original = nativeRegistration || nativeRegistrations[name];
  if (typeof original !== 'function') throw new Error(name + ' registration API is unavailable');
  registered.add(moduleId);
  return original.call(globalThis, decorateObject(definition, moduleId));
}
globalThis[bridgeKey] = {
  App(definition) { return registerDefinition('App', definition); },
  Page(definition) { return registerDefinition('Page', definition); },
  Component(definition, nativeRegistration) { return registerDefinition('Component', definition, nativeRegistration); },
  installNative(name, registration) {
    if (typeof registration === 'function') nativeRegistrations[name] = registration;
  },
  takeNativeDefinitions(name) {
    const pending = pendingNativeDefinitions.get(name) || [];
    pendingNativeDefinitions.delete(name);
    return pending;
  },
  isApplying() { return runtime.applyingPatch; },
  getDebugSnapshot() {
    return {
      definitions: [...definitions.keys()],
      instances: [...instances.entries()].map(([moduleId, values]) => ({ moduleId, count: values.size })),
      registered: [...registered.values()],
      refreshes: [...wevuRefreshes.keys()],
      refreshGenerations: [...wevuRefreshGenerations.entries()],
    };
  },
  trackWevuComponent(definition, refresh) {
    const moduleId = runtime.currentModuleId || runtime.registrationModuleId || 'Component';
    if (!runtime.applyingPatch && runtime.patchedModules.has(moduleId)) {
      return decorateWevuComponent(definition, moduleId);
    }
    definitions.set(moduleId, definition);
    if (typeof refresh === 'function') wevuRefreshes.set(moduleId, refresh);
    if (runtime.applyingPatch) {
      wevuRefreshGenerations.set(moduleId, (wevuRefreshGenerations.get(moduleId) || 0) + 1);
      for (const instance of [...getInstances(moduleId)]) refreshWevuInstance(instance, moduleId);
      return definition;
    }
    return decorateWevuComponent(definition, moduleId);
  },
  ready: true,
  beginUpdate() {
    suppressLifecycles = true;
    rememberTrackedInstances();
    runtime.beginPatch();
  },
  endUpdate() {
    runtime.endPatch();
    restoreTrackedInstances();
    setTimeout(() => { suppressLifecycles = false; });
  }
};
const runtimeGlobal = globalThis.wx || globalThis.my || globalThis.swan || globalThis.tt || globalThis.ali || globalThis.hd || globalThis.qq || globalThis.ks || globalThis.zfb || globalThis.jd || globalThis.xhs;
if (runtimeGlobal && !runtimeGlobal[bridgeKey]) runtimeGlobal[bridgeKey] = globalThis[bridgeKey];
`

export function createStatefulHmrControlSource(control: StatefulHmrControl): string {
  return `
globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}] = ${JSON.stringify(control)};
(() => {
  const control = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}];
  globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]?.stop?.();
  let version = 0;
  let phase = 'registering';
  let pendingBatch;
  let requestGeneration = 0;
  let activeRequest;
  let lastRequestError;
  let lastResponse;
  let timer;
  const sessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const schedule = (delay) => {
    if (timer) clearTimeout(timer);
    const expectedPhase = phase;
    const expectedVersion = version;
    timer = setTimeout(() => {
      timer = undefined;
      if (phase !== expectedPhase || version !== expectedVersion) return;
      send(phase === 'registering' ? 'register' : 'poll');
    }, delay);
  };
  const send = (action) => {
    activeRequest?.abort?.();
    const generation = ++requestGeneration;
    activeRequest = wx.request({
      url: control.url,
      method: 'POST',
      data: { token: control.token, action, buildId: control.buildId, sessionId, version },
      timeout: 30000,
      success(result) {
        if (generation !== requestGeneration) return;
        activeRequest = undefined;
        lastRequestError = undefined;
        const type = result?.data?.type;
        lastResponse = { action, statusCode: result?.statusCode, type };
        if (action === 'register' && type === 'registered') {
          phase = 'polling';
          if (pendingBatch) globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].receiveBatch(pendingBatch.meta, pendingBatch.apply);
          else send('poll');
        } else if (type === 'idle' || type === 'changed') send('poll');
        else if (type === 'batch-published') schedule(2000);
        else if (type === 'rebuilding') schedule(1000);
        else schedule(500);
      },
      fail(error) {
        if (generation !== requestGeneration) return;
        activeRequest = undefined;
        lastRequestError = {
          action,
          errMsg: String(error?.errMsg || ''),
          errno: error?.errno,
        };
        schedule(500);
      }
    });
  };
  const relaunch = () => {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const page = pages[pages.length - 1];
    const route = page?.route || page?.__route__;
    if (!route) return send('poll');
    const query = Object.entries(page?.options || {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
      .join('&');
    wx.reLaunch({ url: '/' + route + (query ? '?' + query : ''), complete: () => send('poll') });
  };
  globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}] = {
    lastApply: undefined,
    getVersion() { return version; },
    getLastApply() { return this.lastApply; },
    getTransportState() { return { phase, version, lastRequestError, lastResponse }; },
    stop() {
      phase = 'stopped';
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      activeRequest?.abort?.();
      activeRequest = undefined;
    },
    applyChangedModules(changedIds) {
      const runtime = globalThis.__rolldown_runtime__;
      if (!runtime || !Array.isArray(changedIds)) return;
      const uniqueIds = [...new Set(changedIds.filter((id) => typeof id === 'string'))];
      const summary = { changedIds: uniqueIds, initialized: [], missing: [], executedBefore: [], executedAfterRemove: [] };
      for (const id of uniqueIds) {
        if (typeof runtime.isExecuted === 'function' && runtime.isExecuted(id)) summary.executedBefore.push(id);
        if (typeof runtime.removeModuleCache === 'function') runtime.removeModuleCache.call(runtime, id);
        if (typeof runtime.isExecuted === 'function' && runtime.isExecuted(id)) summary.executedAfterRemove.push(id);
      }
      for (const id of uniqueIds) {
        if (typeof runtime.hasFactory === 'function' && !runtime.hasFactory(id)) {
          summary.missing.push(id);
          continue;
        }
        if (typeof runtime.initModule === 'function') runtime.initModule.call(runtime, id);
        summary.initialized.push(id);
      }
      this.lastApply = summary;
    },
    receiveBatch(meta, apply) {
      if (phase === 'registering') {
        pendingBatch = { meta, apply };
        return;
      }
      pendingBatch = undefined;
      if (phase !== 'polling' || meta.buildId !== control.buildId || meta.fromVersion !== version) return send('poll');
      phase = 'applying';
      const bridge = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}];
      if (!bridge?.ready) {
        phase = 'polling';
        return send('rebuild');
      }
      bridge.beginUpdate?.();
      try {
        apply();
        globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].applyChangedModules(meta.changedIds);
        version = meta.targetVersion;
        phase = meta.compatible === false ? 'relaunching' : 'polling';
      } catch (error) {
        console.error('[weapp-vite] stateful HMR patch failed', error);
        phase = 'polling';
        return send('rebuild');
      } finally {
        bridge.endUpdate?.();
      }
      if (phase === 'relaunching') relaunch();
      else send('poll');
    }
  };
  send('register');
})();
`
}
