export const richTextHtml = '<p class="lead">Rendered <strong>content</strong> &amp; &lt;safe&gt; &#65; &#x1D11E;&nbsp;</p>'
export const richTextHtmlText = 'Rendered content & <safe> A \u{1D11E}\u00A0'

export const untrustedRichText = [{
  name: 'p',
  attrs: {
    'id': 'untrusted-rich-child',
    'class': '{{secret}}',
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
    { name: 'unsafe-card', children: [{ name: 'b', children: [{ type: 'text', text: 'removed' }] }] },
    { name: 'script', children: [{ type: 'text', text: 'script text' }] },
    { name: 'wxs', children: [{ type: 'text', text: 'wxs text' }] },
    { name: 'a', attrs: { href: 'java\nscript:trap()', onclick: 'trap()' }, children: [{ type: 'text', text: 'link' }] },
    { name: 'img', attrs: { src: 'javascript:trap()', onerror: 'trap()', alt: 'safe image' } },
  ],
}]
export const untrustedRichTextContent = '{{secret}}<script>trap()</script>link'

export const untrustedRichTextHtml = '<p id="untrusted-rich-child" class="{{secret}}" title="{{secret}}" data-state="{{secret}}" data-sim-tap="trap" data-sim-scope="pages/index/index" bindtap="trap" onclick="globalThis.richTextExecuted = true" wx:for="{{items}}" wx:if="{{false}}">{{secret}}&lt;script&gt;trap()&lt;/script&gt;<unsafe-card><b>removed</b></unsafe-card><script>globalThis.richTextExecuted = true</script><style>body { display:none }</style><a href="javascript:trap()">link</a><img src="javascript:trap()" onerror="globalThis.richTextExecuted = true"></p>'
export const untrustedRichTextHtmlContent = '{{secret}}<script>trap()</script>link'

export const nativeRichText = [{
  name: 'DIV',
  attrs: { id: 'rejected', class: 'safe', bindtap: 'trap' },
  children: [
    { type: 'text', text: 'Hello &amp; <b>literal</b> {{secret}} &amp;amp; &#38;amp; &lt;b&gt; ' },
    { name: 'b', children: [{ type: 'text', text: 'world' }] },
    { name: 'NaV', children: [{ type: 'text', text: ' navigation' }] },
    { name: 'FOOTER', children: [{ type: 'text', text: ' footer' }] },
    { name: 'a', attrs: { href: 'https://example.com', target: '_blank' }, children: [{ type: 'text', text: ' link' }] },
    { name: 'unknown', children: [{ name: 'b', children: [{ type: 'text', text: 'removed' }] }] },
    { name: 'script', children: [{ type: 'text', text: 'untrusted' }] },
    { name: 'wxs', children: [{ type: 'text', text: 'throw new Error("executed")' }] },
  ],
}]
export const nativeRichTextContent = 'Hello & <b>literal</b> {{secret}} &amp; &amp; <b> world navigation footer link'
export const nativeRichTextHtml = '<DIV id="rejected" class="safe" bindtap="trap">Hello &amp; &lt;b&gt;literal&lt;/b&gt; {{secret}} &amp;amp; &#38;amp; &lt;b&gt; <b>world</b><NaV> navigation</NaV><FOOTER> footer</FOOTER><a href="https://example.com" target="_blank"> link</a><unknown><b>removed</b></unknown><script>untrusted</script><wxs>throw new Error("executed")</wxs></DIV>'

export const invalidRichTextNodes = [
  { type: 'node', text: 'missing element name' },
  { text: 'missing text type' },
  { type: 'unknown', name: 'p', children: [{ type: 'text', text: 'unknown type subtree' }] },
  { type: null, name: 'p', children: [{ type: 'text', text: 'null type subtree' }] },
  { name: ['p'], children: [{ type: 'text', text: 'nonstring name subtree' }] },
  { name: 42, children: [{ type: 'text', text: 'numeric name subtree' }] },
  { type: 'text' },
  { type: 'text', text: 42 },
  { type: 'text', text: false },
  { type: 'text', text: null },
  { type: 'text', text: ['not a string'] },
  { type: 'text', name: 'p', text: {}, children: [{ type: 'text', text: 'invalid text subtree' }] },
]

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
