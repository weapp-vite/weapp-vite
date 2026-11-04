export function mpxFixtureFiles(target?: string): Record<string, string> {
  const application = target === 'jd'
    ? { pages: ['./pages/index/index', './subpackage/detail/index'] }
    : { pages: ['./pages/index/index'], subPackages: [{ root: 'subpackage', pages: ['./detail/index'] }] }
  return {
    'app.mpx': `<script>
import { createApp } from '@mpxjs/core'
createApp({})
</script>
<script type="application/json">
${JSON.stringify(application)}
</script>
`,
    'pages/index/index.mpx': `<template>
  <view class="page" data-label="{{label}}">
    <wxs module="helper">module.exports = { identity: function(value) { return value } }</wxs>
    <feature-card title="{{label}}" bindchoose="onChoose">
      <view slot="heading">命名插槽 &amp; 😀</view>
      <view wx:if="{{enabled}}">
        <text wx:for="{{items}}" wx:key="id" catchtap="onChoose">{{index}}: {{item.text}}</text>
      </view>
      <view wx:else>明确的另一分支</view>
      <input disabled placeholder="&quot;entity&quot;" />
      <text>{{helper.identity(label)}}</text>
    </feature-card>
  </view>
</template>
<script>
import { createPage } from '@mpxjs/core'
createPage({
  data: { label: '源码 😀', enabled: true, items: [{ id: 1, text: 'A & B' }, { id: 2, text: '换行\\n文本' }] },
  methods: { onChoose() { this.label = 'chosen' } }
})
</script>
<script type="application/json">
{ "usingComponents": { "feature-card": "../../components/feature-card" } }
</script>
`,
    'components/feature-card.mpx': `<template>
  <view data-title="{{title}}">
    <slot name="heading"></slot>
    <text>{{title}}</text>
    <slot></slot>
    <button bindtap="choose">选择 &amp; 😀</button>
  </view>
</template>
<script>
import { createComponent } from '@mpxjs/core'
createComponent({ properties: { title: String }, methods: { choose() { this.triggerEvent('choose', this.title) } } })
</script>
<script type="application/json">{ "component": true }</script>
`,
    'subpackage/detail/index.mpx': '<template><view><text>{{title}}</text><view wx:if="{{title}}">分包页面</view></view></template>\n<script>import { createPage } from "@mpxjs/core"; createPage({ data: { title: "subpackage" } })</script>\n',
  }
}
