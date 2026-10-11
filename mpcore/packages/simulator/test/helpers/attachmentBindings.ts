export function createAttachmentBindingFiles(owner: 'page' | 'component', hidden: boolean, insert = false): Array<[string, string]> {
  const ownerPath = owner === 'page' ? 'pages/index/index' : 'components/owner'
  const child = '<consumer model="{{model}}" />'
  const content = hidden ? `<holder>${child}</holder>` : child
  const files: Array<[string, string]> = [
    ['project.config.json', '{"miniprogramRoot":"./"}'],
    ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
    ['app.js', 'App({ trace: [] })'],
    [`${ownerPath}.json`, JSON.stringify({
      ...(owner === 'component' ? { component: true } : {}),
      usingComponents: { consumer: '/components/consumer', holder: '/components/holder' },
    })],
    [`${ownerPath}.js`, `Component({
      data: { model: null${insert ? ', visible: false' : ''} },
      lifetimes: {
        attached() {
          getApp().trace.push(['owner:attached']);
          this.setData({ model: { label: 'bound' }${insert ? ', visible: true' : ''} });
          getApp().trace.push(['owner:after-setData']);
        }
      },
      methods: { readTrace() { return getApp().trace; } }
    })`],
    [`${ownerPath}.wxml`, insert ? `<block wx:if="{{visible}}">${content}</block>` : content],
    ['components/holder.json', '{"component":true}'],
    ['components/holder.js', 'Component({ data: { open: false } })'],
    ['components/holder.wxml', '<view wx:if="{{open}}"><slot /></view>'],
    ['components/consumer.json', '{"component":true}'],
    ['components/consumer.js', `Component({
      properties: {
        model: {
          type: null,
          value: { label: 'default' },
          observer(value) { getApp().trace.push(['property', value]); }
        }
      },
      lifetimes: {
        attached() { getApp().trace.push(['child:attached', this.properties.model.label]); }
      }
    })`],
    ['components/consumer.wxml', '<text id="bound-model">{{model.label}}</text>'],
  ]
  if (owner === 'component') {
    files.push(
      ['pages/index/index.json', '{"usingComponents":{"owner":"/components/owner"}}'],
      ['pages/index/index.js', 'Page({ readTrace() { return getApp().trace; } })'],
      ['pages/index/index.wxml', '<owner />'],
    )
  }
  return files
}

export const attachmentBindingTrace = [
  ['property', null],
  ['owner:attached'],
  ['property', { label: 'bound' }],
  ['owner:after-setData'],
  ['child:attached', 'bound'],
]
