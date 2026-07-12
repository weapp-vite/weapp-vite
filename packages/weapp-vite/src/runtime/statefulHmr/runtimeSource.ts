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
    if (!this.applyingPatch && this.patchedModules.has(id)) return result;
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
    if (!this.applyingPatch && this.patchedModules.has(id)) return this.loadExports(id);
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
function refreshWevuInstance(instance, moduleId) {
  if (!instance || (typeof instance !== 'object' && typeof instance !== 'function')) return;
  const generation = wevuRefreshGenerations.get(moduleId) || 0;
  if (generation === 0) return;
  let generations = wevuInstanceGenerations.get(instance);
  if (generations?.get(moduleId) === generation) return;
  const refresh = wevuRefreshes.get(moduleId);
  if (typeof refresh !== 'function') return;
  refresh(instance);
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
    return (typeof value === 'function' ? value : fallback)?.apply(this, args);
  };
}
function decorateObject(value, moduleId, prefix = '') {
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
      getInstances(moduleId).add(this);
      return onLoad.apply(this, args);
    };
  }
  if (!prefix && result.lifetimes && typeof result.lifetimes === 'object') {
    const attached = result.lifetimes.attached;
    const detached = result.lifetimes.detached;
    result.lifetimes = { ...result.lifetimes };
    if (typeof attached === 'function') {
      result.lifetimes.attached = function (...args) {
        getInstances(moduleId).add(this);
        return attached.apply(this, args);
      };
    }
    if (typeof detached === 'function') {
      result.lifetimes.detached = function (...args) {
        getInstances(moduleId).delete(this);
        return detached.apply(this, args);
      };
    }
  }
  return result;
}
function decorateWevuComponent(definition, moduleId) {
  const result = { ...definition };
  const methods = { ...(definition.methods || {}) };
  for (const [name, method] of Object.entries(methods)) {
    if (typeof method !== 'function') continue;
    methods[name] = function (...args) {
      getInstances(moduleId).add(this);
      refreshWevuInstance(this, moduleId);
      return method.apply(this, args);
    };
  }
  result.methods = methods;
  const onLoad = definition.onLoad;
  const onUnload = definition.onUnload;
  if (typeof onLoad === 'function') {
    result.onLoad = function (...args) {
      getInstances(moduleId).add(this);
      return onLoad.apply(this, args);
    };
  }
  if (typeof onUnload === 'function') {
    result.onUnload = function (...args) {
      getInstances(moduleId).delete(this);
      return onUnload.apply(this, args);
    };
  }
  const lifetimes = { ...(definition.lifetimes || {}) };
  const attached = lifetimes.attached;
  const detached = lifetimes.detached;
  lifetimes.attached = function (...args) {
    getInstances(moduleId).add(this);
    return attached?.apply(this, args);
  };
  lifetimes.detached = function (...args) {
    getInstances(moduleId).delete(this);
    return detached?.apply(this, args);
  };
  return { ...result, lifetimes };
}
function registerDefinition(name, definition, nativeRegistration) {
  const moduleId = runtime.currentModuleId || runtime.registrationModuleId || name;
  if (!runtime.applyingPatch && runtime.patchedModules.has(moduleId)) return;
  definitions.set(moduleId, definition);
  if (registered.has(moduleId)) {
    return;
  }
  if (name === 'Component') {
    let pending = pendingNativeDefinitions.get(name);
    if (!pending) pendingNativeDefinitions.set(name, pending = []);
    pending.push(decorateObject(definition, moduleId));
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
  trackWevuComponent(definition, refresh) {
    const moduleId = runtime.registrationModuleId || runtime.currentModuleId || 'Component';
    if (!runtime.applyingPatch && runtime.patchedModules.has(moduleId)) return definition;
    definitions.set(moduleId, definition);
    if (typeof refresh === 'function') wevuRefreshes.set(moduleId, refresh);
    if (runtime.applyingPatch) {
      wevuRefreshGenerations.set(moduleId, (wevuRefreshGenerations.get(moduleId) || 0) + 1);
      const currentRefresh = wevuRefreshes.get(moduleId);
      if (typeof currentRefresh === 'function') {
        for (const instance of [...getInstances(moduleId)]) currentRefresh(instance);
      }
      return definition;
    }
    return decorateWevuComponent(definition, moduleId);
  },
  ready: true,
  beginUpdate() {
    suppressLifecycles = true;
    runtime.beginPatch();
  },
  endUpdate() {
    runtime.endPatch();
    setTimeout(() => { suppressLifecycles = false; });
  }
};
`

export function createStatefulHmrControlSource(control: StatefulHmrControl): string {
  return `
globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}] = ${JSON.stringify(control)};
(() => {
  const control = globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}];
  if (globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}]) return;
  let version = 0;
  let phase = 'registering';
  let pendingBatch;
  let requestGeneration = 0;
  let activeRequest;
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
        const type = result?.data?.type;
        if (action === 'register' && type === 'registered') {
          phase = 'polling';
          if (pendingBatch) globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}].receiveBatch(pendingBatch.meta, pendingBatch.apply);
          else send('poll');
        } else if (type === 'idle' || type === 'changed') send('poll');
        else if (type === 'batch-published') schedule(2000);
        else if (type === 'rebuilding') schedule(1000);
        else schedule(500);
      },
      fail() {
        if (generation !== requestGeneration) return;
        activeRequest = undefined;
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
    getVersion() { return version; },
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
