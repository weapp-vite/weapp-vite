export function uniFixtureFiles(modern: boolean): Record<string, string> {
  return {
    'manifest.json': JSON.stringify({ name: 'controlled-parser-matrix', appid: '__UNI__CORPUS', versionName: '1.0.0', versionCode: '100', uniStatistics: { enable: false } }),
    'pages.json': JSON.stringify({ pages: [{ path: 'pages/index/index' }], subPackages: [{ root: 'subpackage', pages: [{ path: 'detail/index' }] }], globalStyle: { navigationBarTitleText: 'Template matrix' } }),
    'App.vue': '<script>export default { onLaunch() {} }</script>\n',
    'main.js': modern
      ? `import { createSSRApp } from 'vue'
import App from './App.vue'
export function createApp() { return { app: createSSRApp(App) } }
`
      : `import Vue from 'vue'
import App from './App.vue'
App.mpType = 'app'
new Vue({ ...App }).$mount()
`,
    'components/feature-card.vue': `<template>
  <view class="card" :data-title="title">
    <slot name="heading"></slot>
    <text>{{ title }}</text>
    <slot></slot>
    <button @tap="$emit('choose', title)">选择 &amp; 😀</button>
  </view>
</template>
<script>export default { props: { title: String } }</script>
`,
    'pages/index/index.vue': `<template>
  <view class="page" :data-label="label">
    <feature-card :title="label" @choose="onChoose">
      <view slot="heading"><text>命名插槽 &amp; 😀</text></view>
      <view v-if="enabled">
        <text v-for="(item, index) in items" :key="item.id" @tap.stop="onChoose(item.text)">{{ index }}: {{ item.text }}</text>
      </view>
      <view v-else>明确的另一分支</view>
      <input disabled placeholder="&quot;entity&quot;" />
      <!-- #ifdef MP-WEIXIN -->
      <text>{{ helper.identity(label) }}</text>
      <!-- #endif -->
    </feature-card>
  </view>
</template>
<script>
import FeatureCard from '../../components/feature-card.vue'
export default {
  components: { FeatureCard },
  data() { return { label: '源码 😀', enabled: true, items: [{ id: 1, text: 'A & B' }, { id: 2, text: '换行\\n文本' }] } },
  methods: { onChoose(value) { this.label = String(value) } }
}
</script>
<!-- #ifdef MP-WEIXIN -->
<script module="helper" lang="wxs">
module.exports = { identity: function(value) { return value } }
</script>
<!-- #endif -->
`,
    'subpackage/detail/index.vue': '<template><view><text>{{ title }}</text><view v-if="title">分包页面</view></view></template>\n<script>export default { data() { return { title: "subpackage" } } }</script>\n',
  }
}
