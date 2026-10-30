export const nativeSelectorAttachmentLeafIds = [
  'hidden-regular',
  'hidden-virtual',
  'visible-regular',
  'visible-virtual',
] as const

export interface NativeSelectorAttachmentQuery {
  phase: string
  rootFound: boolean
  rootId: string | null
  width: number | null
  height: number | null
  missing: null
  missingAll: unknown[]
}

export interface NativeSelectorAttachmentSnapshot {
  open: boolean
  leaves: Record<typeof nativeSelectorAttachmentLeafIds[number], {
    label: string
    sequence: string[]
    queries: NativeSelectorAttachmentQuery[]
  } | null>
}

function leafSource(virtualHost: boolean) {
  return `Component({
    options: { virtualHost: ${virtualHost} },
    properties: { label: String },
    lifetimes: {
      created() { this.queryLog = []; this.queryResults = [] },
      attached() { this.queryLog.push('attached'); this.probe('attached') },
      ready() { this.queryLog.push('ready') }
    },
    methods: {
      probe(phase) {
        this.queryLog.push(phase + ':start');
        const result = { phase, rootFound: false, rootId: null, width: null, height: null, missing: null, missingAll: [] };
        const query = this.createSelectorQuery();
        query.select('.query-root').fields({ id: true, rect: true, size: true }, rect => {
          this.queryLog.push(phase + ':rect');
          result.rootFound = rect != null;
          result.rootId = rect && typeof rect.id === 'string' ? rect.id : null;
          result.width = rect ? rect.width : null;
          result.height = rect ? rect.height : null;
        });
        query.select('.query-missing').boundingClientRect(value => {
          this.queryLog.push(phase + ':missing');
          result.missing = value == null ? null : value;
        });
        query.selectAll('.query-missing').boundingClientRect(values => {
          this.queryLog.push(phase + ':missingAll');
          result.missingAll = values;
        });
        query.exec(() => {
          this.queryLog.push(phase + ':exec');
          this.queryResults.push(result);
        });
        this.queryLog.push(phase + ':end');
      }
    }
  })`
}

const leafTemplate = '<view id="{{label}}" class="query-root" style="width:40px;height:20px">{{label}}</view>'

export const nativeSelectorAttachmentFiles: Array<[string, string]> = [
  ['project.config.json', JSON.stringify({ appid: 'wx1234567890abcdef', miniprogramRoot: './' })],
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.json', JSON.stringify({ usingComponents: {
    'closed-host': '/components/closed-host',
    'layout-host': '/components/layout-host',
    'query-leaf': '/components/query-leaf',
    'virtual-leaf': '/components/virtual-leaf',
  } })],
  ['pages/index/index.js', `Page({
    data: { open: false },
    toggle(open) { this.setData({ open }) },
    probe() {
      this.probeCount = (this.probeCount || 0) + 1;
      const phase = 'probe-' + this.probeCount;
      for (const id of ${JSON.stringify(nativeSelectorAttachmentLeafIds)}) {
        this.selectComponent('#' + id).probe(phase);
      }
      return phase;
    },
    snapshot() {
      const leaves = {};
      for (const id of ${JSON.stringify(nativeSelectorAttachmentLeafIds)}) {
        const leaf = this.selectComponent('#' + id);
        leaves[id] = leaf ? { label: leaf.data.label, sequence: leaf.queryLog, queries: leaf.queryResults } : null;
      }
      return JSON.parse(JSON.stringify({ open: this.data.open, leaves }));
    }
  })`],
  ['pages/index/index.wxml', `<view class="selector-page"><closed-host open="{{open}}">
    <query-leaf id="hidden-regular" label="hidden-regular" />
    <virtual-leaf id="hidden-virtual" label="hidden-virtual" />
  </closed-host>
  <layout-host><view class="visible-content">
    <query-leaf id="visible-regular" label="visible-regular" />
    <virtual-leaf id="visible-virtual" label="visible-virtual" />
  </view></layout-host></view>`],
  ['components/closed-host.json', JSON.stringify({ component: true })],
  ['components/closed-host.js', 'Component({ properties: { open: Boolean } })'],
  ['components/closed-host.wxml', '<view wx:if="{{open}}"><slot /></view>'],
  ['components/layout-host.json', JSON.stringify({ component: true })],
  ['components/layout-host.js', 'Component({})'],
  ['components/layout-host.wxml', '<view class="layout-content"><slot /></view>'],
  ['components/query-leaf.json', JSON.stringify({ component: true })],
  ['components/query-leaf.js', leafSource(false)],
  ['components/query-leaf.wxml', leafTemplate],
  ['components/virtual-leaf.json', JSON.stringify({ component: true })],
  ['components/virtual-leaf.js', leafSource(true)],
  ['components/virtual-leaf.wxml', leafTemplate],
]
