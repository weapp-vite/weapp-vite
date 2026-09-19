export type NativeStyleRegistration = 'Page' | 'Component'

export const nativeStyleHmrStages = [
  { token: 'base', value: '#f6f7fb', color: 'rgb(246, 247, 251)' },
  { token: 'base', value: '#f6f7fb', color: 'rgb(246, 247, 251)' },
  { token: 'blue', value: '#dbeafe', color: 'rgb(219, 234, 254)' },
  { token: '', value: '', color: 'rgba(0, 0, 0, 0)' },
  { token: 'yellow', value: '#fef3c7', color: 'rgb(254, 243, 199)' },
  { token: 'pink', value: '#fce7f3', color: 'rgb(252, 231, 243)' },
  { token: 'pink', value: '#fce7f3', color: 'rgb(252, 231, 243)' },
]

/** 供真实 IDE、Node 和浏览器共同消费的原生样式更新场景。 */
export function createNativeStyleHmrFiles(registration: NativeStyleRegistration, index: number): Map<string, string> {
  const background = nativeStyleHmrStages[index]!
  const local = index === nativeStyleHmrStages.length - 1
  const globalCss = `.probe { min-height: 100px; padding: 16px; }
.bg-base { background-color: #f6f7fb; }
${background.token && background.token !== 'base' ? `.bg-${background.token} { background-color: ${background.value}; }` : ''}`
  return new Map([
    ['app.js', 'App({ onLaunch() { this.__e2eHmrLaunch = Date.now(); } });'],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'], subPackages: [] })],
    ['app.wxss', '@import "./weapp-vite-global.wxss";'],
    ['weapp-vite-global.wxss', globalCss],
    ['pages/index/index.js', registration === 'Page'
      ? 'Page({ data: { count: 0 }, increment() { this.setData({ count: this.data.count + 1 }); } });'
      // 对齐模板实际页面产物：编译器会剥离 defaults 中的 virtualHost:true。
      : 'Component({ options: { virtualHost: false, styleIsolation: "apply-shared" }, data: { count: 0 }, methods: { increment() { this.setData({ count: this.data.count + 1 }); } } });'],
    ['pages/index/index.json', JSON.stringify({ usingComponents: {} })],
    ['pages/index/index.wxml', `<view id="native-style-probe" class="probe ${background.token ? `bg-${background.token}` : ''}" data-stage="${index}">
${local ? '<view id="native-local-probe" class="bg-pink local-priority">Local style</view>' : ''}
<text id="native-count">{{count}}</text><button id="native-increment" bindtap="increment">Increment</button></view>`],
    ['pages/index/index.wxss', `${globalCss}${local ? '\n.local-priority { background-color: #1f2937; }' : ''}`],
  ])
}
