export type UpstreamCompatibilityMode = 'dynamic-island' | 'native-wxml' | 'runtime' | 'unsupported-diagnostic'

export interface UpstreamCompatibilityCase {
  category: string
  mode: UpstreamCompatibilityMode
  source: string
  upstream: string
}

export const UPSTREAM_COMPATIBILITY_SOURCES = {
  vueCore: {
    repository: 'vuejs/core',
    tag: 'v3.5.41',
    license: 'MIT',
  },
  vueJsx: {
    repository: 'vuejs/babel-plugin-jsx',
    tag: 'v3.0.0',
    license: 'MIT',
  },
} as const

/**
 * 上游用例来源：
 * - vuejs/core v3.5.41（MIT）
 * - vuejs/babel-plugin-jsx v3.0.0（MIT）
 *
 * 这里只保留与小程序编译语义有关的最小输入，不复制 DOM renderer 断言。
 */
export const UPSTREAM_COMPATIBILITY_CASES: UpstreamCompatibilityCase[] = [
  { category: 'fragment', mode: 'native-wxml', source: '<><view>A</view><text>B</text></>', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-attrs', mode: 'native-wxml', source: '<view id="root" class="box" />', upstream: 'babel-plugin-jsx/index' },
  { category: 'dynamic-attrs', mode: 'native-wxml', source: '<input placeholder={placeholder} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'native-events', mode: 'native-wxml', source: '<button onTap={tap}>tap</button>', upstream: 'babel-plugin-jsx/index' },
  { category: 'component-events', mode: 'native-wxml', source: '<Panel onChange={change} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'conditional', mode: 'native-wxml', source: 'ok ? <view>A</view> : <view>B</view>', upstream: 'compiler-core/transforms' },
  { category: 'logical-and', mode: 'native-wxml', source: 'ok && <view>A</view>', upstream: 'compiler-core/transforms' },
  { category: 'logical-or', mode: 'native-wxml', source: 'ok || <view>fallback</view>', upstream: 'compiler-core/transforms' },
  { category: 'list', mode: 'native-wxml', source: 'list.map(item => <view key={item.id}>{item.name}</view>)', upstream: 'compiler-core/vFor' },
  { category: 'array-children', mode: 'native-wxml', source: '[<view>A</view>, <text>B</text>]', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-spread-props', mode: 'native-wxml', source: '<view {...{ id: "root", hidden: false }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-spread-string-key', mode: 'native-wxml', source: '<view {...{ "data-kind": "card" }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-class-array', mode: 'native-wxml', source: '<view class={["card", "active"]} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-class-object', mode: 'native-wxml', source: '<view class={{ card: true, hidden: false }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'static-style-object', mode: 'native-wxml', source: '<view style={{ color: "red", fontSize: "12px" }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'v-if', mode: 'native-wxml', source: '<view v-if={ready} />', upstream: 'compiler-core/vIf' },
  { category: 'v-show', mode: 'native-wxml', source: '<view v-show={visible} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'v-text', mode: 'native-wxml', source: '<text v-text={label} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'dynamic-spread-props', mode: 'dynamic-island', source: '<view {...props} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'partially-dynamic-spread', mode: 'dynamic-island', source: '<view {...{ ...props, id: "root" }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'spread-child', mode: 'dynamic-island', source: '<view>{...children}</view>', upstream: 'babel-plugin-jsx/index' },
  { category: 'member-component', mode: 'dynamic-island', source: '<Form.Item />', upstream: 'babel-plugin-jsx/index' },
  { category: 'dynamic-component', mode: 'dynamic-island', source: '<component is={Current} />', upstream: 'compiler-core/transforms' },
  { category: 'object-slots', mode: 'dynamic-island', source: '<Panel>{{ default: () => <view>A</view>, header: () => <text>H</text> }}</Panel>', upstream: 'babel-plugin-jsx/index' },
  { category: 'function-slot', mode: 'dynamic-island', source: '<Panel>{() => <view>A</view>}</Panel>', upstream: 'babel-plugin-jsx/index' },
  { category: 'v-slots', mode: 'dynamic-island', source: '<Panel v-slots={slots} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'v-model', mode: 'runtime', source: '<input v-model={value} />', upstream: 'babel-plugin-jsx/v-model' },
  { category: 'named-v-model', mode: 'dynamic-island', source: '<Panel v-model:visible={visible} />', upstream: 'babel-plugin-jsx/v-model' },
  { category: 'modified-v-model', mode: 'dynamic-island', source: '<Panel v-model:visible_trim={[visible, ["trim"]]} />', upstream: 'babel-plugin-jsx/v-model' },
  { category: 'v-models', mode: 'dynamic-island', source: '<Panel v-models={[[foo, "foo"], [bar, "bar"]]} />', upstream: 'babel-plugin-jsx/v-models' },
  { category: 'dynamic-class-object', mode: 'dynamic-island', source: '<view class={{ active: ready }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'dynamic-style-object', mode: 'dynamic-island', source: '<view style={{ color }} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'unknown-render-call', mode: 'dynamic-island', source: 'renderContent(value)', upstream: 'babel-plugin-jsx/index' },
  { category: 'v-html', mode: 'unsupported-diagnostic', source: '<view v-html={html} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'custom-directive', mode: 'unsupported-diagnostic', source: '<view v-custom:arg={value} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'dom-property', mode: 'unsupported-diagnostic', source: '<view innerHTML={html} />', upstream: 'babel-plugin-jsx/index' },
  { category: 'keep-alive', mode: 'unsupported-diagnostic', source: '<KeepAlive><Panel /></KeepAlive>', upstream: 'compiler-core/transforms' },
  { category: 'transition', mode: 'unsupported-diagnostic', source: '<Transition><view /></Transition>', upstream: 'compiler-core/transforms' },
  { category: 'teleport', mode: 'unsupported-diagnostic', source: '<Teleport to="#root"><view /></Teleport>', upstream: 'compiler-core/transforms' },
]
