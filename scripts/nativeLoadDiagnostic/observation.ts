import { randomUUID } from 'node:crypto'
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type NativeLoadMode = 'off' | 'on-no-load' | 'load-only' | 'actual'

export interface NativeLoadDiagnosticOptions {
  mode: NativeLoadMode
  nativePath: string
  directory: string
}

const preloadSource = String.raw`
const fs = require('node:fs');
const { threadId, isMainThread } = require('node:worker_threads');
const { channel } = require('node:diagnostics_channel');
const key = Symbol.for('weapp-vite.native-load-diagnostic.observer');
if (globalThis[key]) throw new Error('Native loading diagnostic observer already installed');
if (isMainThread) {
  try {
    fs.writeFileSync(config.owner, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  } catch {
    throw new Error('Native loading diagnostic directory already claimed by a process');
  }
} else {
  const owner = JSON.parse(fs.readFileSync(config.owner, 'utf8'));
  if (owner.pid !== process.pid) throw new Error('Native loading diagnostic worker has no owned process');
}
let seq = 0;
let invalidEvents = 0;
let phase = 'startup';
const start = process.hrtime.bigint();
const emit = (kind, data = {}) => {
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  fs.appendFileSync(config.trace, JSON.stringify({ version: 1, pid: process.pid, threadId, seq: seq++, elapsedMs, mode: config.mode, phase, kind, ...data }) + '\n');
};
globalThis[key] = Object.freeze({ token: config.token, mode: config.mode, emit });
const events = channel('weapp-vite.ast.native-analysis');
const phases = channel('weapp-vite.ast.native-load-diagnostic.phase');
const invalid = origin => { invalidEvents++; emit('invalid-event', { origin }); };
const receive = event => {
  let value;
  try {
    if (event && event.kind === 'call' && typeof event.batch === 'boolean'
      && Number.isSafeInteger(event.inputScripts) && event.inputScripts >= 0
      && Number.isSafeInteger(event.inputBytes) && event.inputBytes >= 0) {
      value = { kind: 'call', batch: event.batch, inputScripts: event.inputScripts, inputBytes: event.inputBytes };
    } else if (event && ['cacheHits', 'fallbacks', 'loadFailures'].includes(event.kind)) {
      value = { kind: event.kind };
    }
  } catch {}
  if (!value) return invalid('channel');
  const { kind, ...data } = value;
  emit(kind, { origin: 'channel', ...data });
};
const receivePhase = event => {
  let next;
  try { next = event && event.phase; } catch {}
  if (typeof next !== 'string' || !/^[a-z0-9-]{1,64}$/.test(next)) return invalid('phase');
  phase = next;
  emit('phase');
};
events.subscribe(receive);
phases.subscribe(receivePhase);
emit('started', { nativeEnabled: process.env.WEAPP_VITE_NATIVE === '1', bindingConfigured: process.env.WEAPP_VITE_NATIVE_AST_PATH === config.binding });
process.once('exit', exitCode => {
  events.unsubscribe(receive);
  phases.unsubscribe(receivePhase);
  emit('finished', { exitCode, invalidEvents });
});
`

const bindingSource = String.raw`
const observer = globalThis[Symbol.for('weapp-vite.native-load-diagnostic.observer')];
if (!observer || observer.token !== config.token || observer.mode !== config.mode) {
  throw new Error('Native loading diagnostic binding requires its matching preload');
}
const { emit } = observer;
emit('binding-request');
if (config.mode === 'off') throw new Error('Disabled native diagnostic must not request a binding');
if (config.mode === 'on-no-load') {
  module.exports = {};
} else {
  const cached = new Set(Object.keys(require.cache).filter(file => file.endsWith('.node')));
  const loadedNodes = () => Object.keys(require.cache).filter(file => file.endsWith('.node') && !cached.has(file)).length;
  emit('load-start');
  const start = process.hrtime.bigint();
  let native;
  try {
    native = require(config.nativePath);
    emit('load-success', { durationMs: Number(process.hrtime.bigint() - start) / 1e6, nodeModulesAdded: loadedNodes() });
  } catch (error) {
    emit('load-error', { durationMs: Number(process.hrtime.bigint() - start) / 1e6, nodeModulesAdded: loadedNodes() });
    throw error;
  }
  if (config.mode === 'load-only') {
    module.exports = {};
  } else {
    if (!native || typeof native !== 'object') throw new Error('Native diagnostic binding must export an object');
    const methods = new Map();
    let proxy;
    const wrap = (value, property) => {
      if (typeof value !== 'function') return value;
      let entries = methods.get(property);
      if (entries && entries.original === value) return entries.wrapped;
      const method = typeof property === 'string' && /^[a-zA-Z0-9_$]{1,128}$/.test(property) ? property : 'other';
      const wrapped = new Proxy(value, {
        apply(target, receiver, args) {
          emit('binding-call', { method });
          let result;
          try {
            result = Reflect.apply(target, receiver === proxy ? native : receiver, args);
          } catch (error) {
            emit('binding-exception', { method });
            throw error;
          }
          emit('binding-return', { method, nullish: result === undefined || result === null });
          return result;
        },
      });
      methods.set(property, { original: value, wrapped });
      return wrapped;
    };
    // 空壳避免不可配置的 N-API export 触发 Proxy get 不变量；值与接收者仍转发原模块。
    proxy = new Proxy({}, {
      get: (_, property, receiver) => wrap(Reflect.get(native, property, receiver === proxy ? native : receiver), property),
      set: (_, property, value, receiver) => Reflect.set(native, property, value, receiver === proxy ? native : receiver),
      has: (_, property) => Reflect.has(native, property),
      ownKeys: () => Reflect.ownKeys(native),
      getPrototypeOf: () => Reflect.getPrototypeOf(native),
      getOwnPropertyDescriptor(_, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(native, property);
        if (!descriptor) return undefined;
        return 'value' in descriptor
          ? { ...descriptor, configurable: true, value: wrap(descriptor.value, property) }
          : { ...descriptor, configurable: true };
      },
    });
    module.exports = proxy;
  }
}
`

/**
 * 在全新目录生成独立诊断入口；只观察生产懒加载边界，不预加载 native。
 * 目录不可复用；原始轨迹含本机进程标识，不能直接作为公开报告。
 */
export async function createNativeLoadDiagnostic(options: NativeLoadDiagnosticOptions) {
  const { mode, directory } = options
  if (!['off', 'on-no-load', 'load-only', 'actual'].includes(mode)) {
    throw new Error('Unknown native loading diagnostic mode')
  }
  if (!path.isAbsolute(directory) || !path.isAbsolute(options.nativePath)) {
    throw new Error('Native diagnostic paths must be absolute')
  }
  const nativePath = await realpath(options.nativePath)
  if (!(await stat(nativePath)).isFile()) {
    throw new Error('Native diagnostic binding must be a regular file')
  }
  // 非递归 mkdir 保证调用方显式拥有父目录，且既有目录绝不被覆盖或清理。
  await mkdir(directory, { mode: 0o700 })
  const preload = path.join(directory, 'preload.cjs')
  const binding = path.join(directory, 'binding.cjs')
  const trace = path.join(directory, 'trace.jsonl')
  const config = { mode, nativePath, binding, trace, owner: path.join(directory, 'process-owner.json'), token: randomUUID() }
  const header = `const config = ${JSON.stringify(config)};\n`
  await writeFile(trace, '', { flag: 'wx', mode: 0o600 })
  await writeFile(preload, header + preloadSource, { flag: 'wx', mode: 0o600 })
  await writeFile(binding, header + bindingSource, { flag: 'wx', mode: 0o600 })
  return {
    preload,
    binding,
    trace,
    environment: { WEAPP_VITE_NATIVE: mode === 'off' ? '0' as const : '1' as const, WEAPP_VITE_NATIVE_AST_PATH: binding },
  }
}
