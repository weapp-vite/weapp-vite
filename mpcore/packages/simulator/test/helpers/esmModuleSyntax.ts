export const esmModuleSyntaxCases = [
  {
    name: 'formatted',
    source: 'import { marker } from "../shared.js"\nPage({ data: { marker } })',
  },
  {
    name: 'compact',
    source: 'import{marker}from"../shared.js";Page({data:{marker}});',
  },
  {
    name: 'multiline',
    source: 'import {\n marker\n} from "../shared.js";\nPage({ data: { marker } })',
  },
  {
    name: 'same-line declarations',
    source: 'import {marker} from "../shared.js"; export {marker}; Page({data:{marker}});',
  },
] as const

export function esmModuleSyntaxFiles(source: string): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ miniprogramRoot: './' })],
    ['app.json', JSON.stringify({ pages: ['pages/index'] })],
    ['app.js', 'App({})'],
    ['shared.js', 'export const marker = "esm-ready";'],
    ['pages/index.js', source],
    ['pages/index.wxml', '<view id="marker">{{marker}}</view>'],
  ]
}

export function esmModuleRuntimePreludeFiles(): Array<[string, string]> {
  return esmModuleSyntaxFiles(`
    import { marker, installRuntime } from '../shared.js';
    import * as namespace from '../shared.js';
    let readonly = false;
    try { namespace.marker = 'changed'; } catch (error) { readonly = error instanceof TypeError; }
    Page({ data: { marker, installed: installRuntime(), readonly, extensible: Object.isExtensible(namespace) } });
  `).map(([file, source]): [string, string] => [file, file === 'shared.js'
    ? `
      Object.defineProperty(exports, 'installRuntime', { enumerable: false, get: () => installRuntime });
      function installRuntime() { return 'runtime-ready'; }
      export const marker = 'esm-ready';
    `
    : source])
}

export function esmModuleLiveFiles(): Array<[string, string]> {
  return esmModuleSyntaxFiles(`
    import empty, { total as count, increment, receiver, second, label, first, namespace } from '../bridge.js';
    import * as shared from '../shared.js';
    import '../shared.js';
    const initial = count;
    const object = { count, [count]: 'computed' };
    function shadow(count) { return { count }; }
    function hoisted() { const before = typeof count; var count = 'local'; return before + ':' + count; }
    function parameter(value = count) { var count = 99; return value; }
    function block() { let result = count; { const count = 40; result += count; } return result; }
    let caught;
    try { throw 6; } catch (count) { caught = count; }
    let loop;
    for (const count of [7]) loop = count;
    let selected;
    switch (count) { case 1: let count = 12; selected = count; break; }
    let readonly = false;
    try { count = 99; } catch (error) { readonly = error instanceof TypeError; }
    Page({
      data: {
        initial, count, second, label, first, empty, object, readonly, caught, loop, selected,
        shadow: shadow(8).count, hoisted: hoisted(), parameter: parameter(), block: block(),
        receiver: receiver(), namespaceReceiver: namespace.receiver(), sameNamespace: namespace === shared,
        loads: globalThis.esmLoads, moduleThis: this === undefined,
      },
      increment() { increment(); this.setData({ count, namespaceCount: namespace.count, sharedCount: shared.count }); },
    });
  `).map(([file, source]): [string, string] => file === 'shared.js'
    ? [file, `
      globalThis.esmLoads = (globalThis.esmLoads || 0) + 1;
      export let count = 1, second = 'secondary';
      export const { label, deep: [first] } = { label: 'shared', deep: [3] };
      export function increment() { count++; return count; }
      export function receiver() { return this === undefined; }
      export default null;
    `]
    : [file, file === 'pages/index.wxml' ? '<view id="marker">{{count}}</view>' : source]).concat([['bridge.js', `
      export { count as total, increment, receiver, default } from './shared.js';
      export * from './shared.js';
      export * as namespace from './shared.js';
    `]])
}

export const esmModuleInitialState = {
  initial: 1,
  count: 1,
  second: 'secondary',
  label: 'shared',
  first: 3,
  empty: null,
  object: { count: 1, 1: 'computed' },
  readonly: true,
  caught: 6,
  loop: 7,
  selected: 12,
  shadow: 8,
  hoisted: 'undefined:local',
  parameter: 1,
  block: 41,
  receiver: true,
  namespaceReceiver: false,
  sameNamespace: true,
  loads: 1,
  moduleThis: true,
}

export function esmModuleCycleFiles(anonymousDefault = false): Array<[string, string]> {
  return esmModuleSyntaxFiles('import { marker } from "../shared.js"; Page({ data: { marker } });')
    .map(([file, content]): [string, string] => [file, file !== 'shared.js'
      ? content
      : anonymousDefault
        ? 'import { marker } from "./cycle.js"; export default function() { return "esm-ready"; } export { marker };'
        : 'import { read } from "./cycle.js"; export function markerFunction() { return "esm-ready"; } export const marker = read();'])
    .concat([['cycle.js', anonymousDefault
      ? 'import markerFunction from "./shared.js"; export const marker = markerFunction();'
      : 'import { markerFunction } from "./shared.js"; export function read() { return markerFunction(); }']])
}
