/** 自产条件模板只验证受控链路，不计入真实上游语料。 */
export function antFixtureFiles(): Record<string, string> {
  return {
    'src/Card/index.md': '---\nsupportPlatform: [alipay, wechat]\n---\n',
    'src/Card/index.axml': `<!-- #if ALIPAY -->
<view onTap="tap">支付宝</view>
<!-- #endif -->
<!-- #if WECHAT -->
<view onTap="tap">微信</view>
<!-- #endif -->
<view a:for="{{items}}" a:key="id"><slot name="header"/><slot/>😀 &amp; {{item.label}}</view>
`,
    'src/AliOnly/index.md': '---\nsupportPlatform: [alipay]\n---\n',
    'src/AliOnly/index.axml': '<view>支付宝独有</view>\n',
    'demo/pages/index/index.axml': '<view><ant-card onTap="tap"/><view slot="header">示例</view></view>\n',
    'copilot/Bubble/index.md': '---\nsupportPlatform: [alipay, wechat]\n---\n',
    'copilot/Bubble/index.axml': '<view><text>{{content}}</text><slot/></view>\n',
  }
}
