export const tdesignStyleRoute = '/subpackages/lab/class-binding/index'
export const tdesignStyleProbes = [
  ['class-object', 'Object Syntax'],
  ['class-static-object', 'Static + Object'],
  ['class-reactive', 'Reactive Object'],
  ['class-array', 'Array Syntax'],
  ['class-cond-array', 'Conditional Array'],
  ['class-array-key', 'Array + Key'],
  ['style-object', 'Style Object'],
  ['style-array', 'Style Array'],
  ['style-string', 'Style String'],
  ['style-var', 'Style Variable'],
] as const

export const tdesignStyleScenarios = [
  { id: 'initial', method: null, active: true, error: false, round: false, ghost: false },
  { id: 'base', method: 'applyScenarioBase', active: false, error: false, round: false, ghost: false },
  { id: 'all-on', method: 'applyScenarioAllOn', active: true, error: true, round: true, ghost: true },
  { id: 'mixed', method: 'applyScenarioMixed', active: true, error: false, round: true, ghost: false },
  { id: 'error-ghost', method: 'applyScenarioErrorGhost', active: false, error: true, round: false, ghost: true },
] as const

const pageScript = `
function bindings(state, active, error, round, ghost) {
  const classes = values => values.filter(Boolean).join(' ');
  const color = error ? '#b91c1c' : active ? '#ffffff' : '#1f1a3f';
  const accent = error ? '#ef4444' : '#2563eb';
  return {
    state,
    classObject: active ? 'demo-active' : '',
    classStaticObject: classes([active && 'demo-active', error && 'text-danger']),
    classReactive: classes([active && 'demo-active', error && 'text-danger', round && 'demo-round', ghost && 'demo-ghost']),
    classArray: classes([active && 'demo-active', error && 'text-danger', round && 'demo-round']),
    classCondArray: classes([active && 'demo-active', error && 'text-danger']),
    classArrayKey: classes([active && 'demo-active', error && 'text-danger', ghost && 'demo-ghost']),
    styleObject: 'color:' + color + ';border-style:' + (ghost ? 'dashed' : 'solid') + ';border-radius:' + (round ? 999 : 18) + 'rpx;',
    styleArray: 'opacity:' + (ghost ? '0.78' : '1') + ';border-radius:' + (round ? 999 : 18) + 'rpx;',
    styleString: 'color:' + (error ? '#b91c1c' : '#1f1a3f') + ';font-size:' + (active ? 26 : 24) + 'rpx;',
    styleVar: '--lab-accent:' + accent + ';color:var(--lab-accent);border-color:var(--lab-accent);'
  };
}
Page({
  data: bindings('initial', true, false, false, false),
  applyScenarioBase() { this.setData(bindings('base', false, false, false, false)); },
  applyScenarioAllOn() { this.setData(bindings('all-on', true, true, true, true)); },
  applyScenarioMixed() { this.setData(bindings('mixed', true, false, true, false)); },
  applyScenarioErrorGhost() { this.setData(bindings('error-ghost', false, true, false, true)); }
});
`

const bindings: Record<(typeof tdesignStyleProbes)[number][0], string> = {
  'class-object': 'class="demo-block {{classObject}}"',
  'class-static-object': 'class="demo-block demo-ghost {{classStaticObject}}"',
  'class-reactive': 'class="demo-block {{classReactive}}"',
  'class-array': 'class="demo-block {{classArray}}"',
  'class-cond-array': 'class="demo-block {{classCondArray}}"',
  'class-array-key': 'class="demo-block {{classArrayKey}}"',
  'style-object': 'class="demo-block" style="{{styleObject}}"',
  'style-array': 'class="demo-block" style="{{styleArray}}"',
  'style-string': 'class="demo-block" style="{{styleString}}"',
  'style-var': 'class="demo-block" style="{{styleVar}}"',
}

/** 对齐真实 IDE 的五状态、十 probe；接收原生宿主绑定值，不替代 SFC 编译与 rpx 布局验收。 */
export const tdesignStyleBindingFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', JSON.stringify({ pages: [tdesignStyleRoute.slice(1)] })],
  ['app.js', 'App({})'],
  ['app.wxss', ''],
  [`${tdesignStyleRoute.slice(1)}.js`, pageScript],
  [`${tdesignStyleRoute.slice(1)}.wxml`, [
    ...tdesignStyleScenarios.filter(item => item.method).map(item => `<button id="scenario-${item.id}" bindtap="${item.method}">${item.id}</button>`),
    '<text id="scenario-state">{{state}}</text>',
    ...tdesignStyleProbes.map(([key, title]) => `<view id="class-binding-probe-${key}" ${bindings[key]}><text class="font-semibold">${title}</text></view>`),
  ].join('')],
  [`${tdesignStyleRoute.slice(1)}.wxss`, `
    .demo-block { display: block; color: #1f1a3f; border-style: solid; border-color: #d7d9f2; }
    .demo-active { color: #fff; }
    .text-danger { color: #b91c1c; }
    .demo-ghost { border-style: dashed; }
    .demo-round { border-radius: 999rpx; }
  `],
]
