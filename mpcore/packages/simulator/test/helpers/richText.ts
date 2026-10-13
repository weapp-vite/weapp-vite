export const richTextHtml = '<p class="lead">Rendered <strong>content</strong> &amp; &lt;safe&gt; &#65; &#x1D11E;&nbsp;</p>'
export const richTextHtmlText = 'Rendered content & <safe> A \u{1D11E}\u00A0'

export const untrustedRichText = [{
  name: 'p',
  attrs: {
    'id': 'untrusted-rich-child',
    'title': '{{secret}}',
    'data-state': '{{secret}}',
    'data-sim-tap': 'trap',
    'data-sim-scope': 'pages/index/index',
    'data-sim-component': 'unsafe-card',
    'data-sim-node': 'forged',
    'bindtap': 'trap',
    'onclick': 'globalThis.richTextExecuted = true',
    'wx:for': '{{items}}',
    'wx:if': '{{false}}',
    'style': 'color: red; width: expression(trap()); background: url(javascript:trap())',
  },
  children: [
    { type: 'text', text: '{{secret}}<script>trap()</script>' },
    { name: 'unsafe-card', children: [{ type: 'text', text: 'kept' }] },
    { name: 'script', children: [{ type: 'text', text: 'script text' }] },
    { name: 'wxs', children: [{ type: 'text', text: 'wxs text' }] },
    { name: 'a', attrs: { href: 'java\nscript:trap()', onclick: 'trap()' }, children: [{ text: 'link' }] },
    { name: 'img', attrs: { src: 'javascript:trap()', onerror: 'trap()', alt: 'safe image' } },
  ],
}]
export const untrustedRichTextContent = '{{secret}}<script>trap()</script>keptscript textwxs textlink'

export const untrustedRichTextHtml = '<p id="untrusted-rich-child" title="{{secret}}" data-state="{{secret}}" data-sim-tap="trap" data-sim-scope="pages/index/index" bindtap="trap" onclick="globalThis.richTextExecuted = true" wx:for="{{items}}" wx:if="{{false}}">{{secret}}&lt;script&gt;trap()&lt;/script&gt;<unsafe-card>kept</unsafe-card><script>globalThis.richTextExecuted = true</script><style>body { display:none }</style><a href="javascript:trap()">link</a><img src="javascript:trap()" onerror="globalThis.richTextExecuted = true"></p>'
export const untrustedRichTextHtmlContent = '{{secret}}<script>trap()</script>keptlink'

export const richTextFiles: Array<[string, string]> = [
  ['project.config.json', '{"miniprogramRoot":"."}'],
  ['app.json', '{"pages":["pages/index/index","pages/custom/index"]}'],
  ['app.js', 'App({globalData:{attached:0}})'],
  ['pages/index/index.json', '{"usingComponents":{"unsafe-card":"/components/trap/index","p":"/components/trap/index"}}'],
  ['pages/index/index.js', `Page({
    data: {
      nodes: [{name:'p',children:[{type:'text',text:'Rendered content'}]}],
      html: ${JSON.stringify(richTextHtml)},
      secret: 'INTERPOLATED_SECRET',
      items: [1,2],
      calls: 0,
      outerTaps: 0,
    },
    trap() { this.setData({ calls: this.data.calls + 1 }) },
    onOuterTap() { this.setData({ outerTaps: this.data.outerTaps + 1 }) },
  })`],
  ['pages/index/index.wxml', '<view><text id="plain">Rendered content</text><rich-text id="structured" nodes="{{nodes}}" bindtap="onOuterTap"><unsafe-card /></rich-text><rich-text id="html" nodes="{{html}}" /><rich-text id="empty"><unsafe-card /></rich-text><rich-text id="literal" nodes="<p>literal &amp; text</p>" /></view>'],
  ['pages/custom/index.json', '{"usingComponents":{"rich-text":"/components/custom/index"}}'],
  ['pages/custom/index.js', 'Page({data:{nodes:[{name:"p",children:[{type:"text",text:"native content"}]}]}})'],
  ['pages/custom/index.wxml', '<rich-text id="custom-rich" nodes="{{nodes}}" />'],
  ['components/custom/index.json', '{"component":true}'],
  ['components/custom/index.js', 'Component({properties:{nodes:Array}})'],
  ['components/custom/index.wxml', '<text id="custom-content">custom:{{nodes[0].children[0].text}}</text>'],
  ['components/trap/index.json', '{"component":true}'],
  ['components/trap/index.js', 'Component({lifetimes:{attached(){getApp().globalData.attached++}}})'],
  ['components/trap/index.wxml', '<text>COMPONENT_EXECUTED</text>'],
]
