/// <reference types="node" />

import assert from 'node:assert/strict'
import {
  describe,
  it,
} from 'vitest'
import {
  formatWxmlText,
} from './wxmlFormatter'

function format(input: string) {
  return formatWxmlText(input, { indent: '  ' })
}

const exactCases = [
  {
    name: 'wraps many attributes and preserves WXML directives',
    input: '<button class="btn" style="color: red;" bind:tap="onTap" data-id="{{item.id}}" data-type="{{item.type}}" disabled="{{loading}}">提交</button>',
    expected: `<button
  class="btn"
  style="color: red;"
  bind:tap="onTap"
  data-id="{{item.id}}"
  data-type="{{item.type}}"
  disabled="{{loading}}"
>
  提交
</button>
`,
  },
  {
    name: 'formats nested swiper tags',
    input: '<swiper indicator-dots="true"><swiper-item><view>页面1</view></swiper-item><swiper-item><view>页面2</view></swiper-item></swiper>',
    expected: `<swiper indicator-dots="true">
  <swiper-item>
    <view>页面1</view>
  </swiper-item>
  <swiper-item>
    <view>页面2</view>
  </swiper-item>
</swiper>
`,
  },
  {
    name: 'preserves boolean attributes',
    input: '<input type="text" disabled required placeholder="请输入" maxlength="100" />',
    expected: `<input
  type="text"
  disabled
  required
  placeholder="请输入"
  maxlength="100" />
`,
  },
  {
    name: 'keeps wrapped text content with the closing text tag',
    input: '<text class="tip-wrap cashback-wrap" wx:if="{{item.incomeSource && item.incomeSource === \'platform_cashback\'}}" >限时奖励</text>',
    expected: `<text
  class="tip-wrap cashback-wrap"
  wx:if="{{item.incomeSource && item.incomeSource === 'platform_cashback'}}"
>限时奖励</text>
`,
  },
  {
    name: 'wraps text attributes while preserving inline text content',
    input: '<text class="title" data-id="123" bind:tap="handleTap" style="color:red">这是文本内容</text>',
    expected: `<text
  class="title"
  data-id="123"
  bind:tap="handleTap"
  style="color:red"
>这是文本内容</text>
`,
  },
  {
    name: 'wraps text boolean attributes while preserving inline text content',
    input: '<text class="asda" tabindex assdassd asd>asdasdasdsaaszdasd asdasdasd asdasd asd asd asd asd asd asd asd a</text>',
    expected: `<text
  class="asda"
  tabindex
  assdassd
  asd
>asdasdasdsaaszdasd asdasdasd asdasd asd asd asd asd asd asd asd a</text>
`,
  },
  {
    name: 'keeps short text tags on one line',
    input: '<text class="tip-wrap cashback-wrap">限时奖励</text>',
    expected: '<text class="tip-wrap cashback-wrap">限时奖励</text>\n',
  },
]

const upstreamScriptCases = [
  '<view class="container"><text wx:if="{{show}}">Hello World</text><button bind:tap="onTap" class="btn">Click Me</button></view>',
  '<view><text wx:if="{{condition}}">显示文本</text><text wx:elif="{{other}}">其他文本</text><text wx:else>默认文本</text></view>',
  '<view wx:for="{{list}}" wx:key="id" wx:for-item="item" wx:for-index="index"><text>{{item.name}}</text></view>',
  '<button bind:tap="onTap" catch:touchstart="onTouch" capture-bind:longpress="onLongPress">按钮</button>',
  '<text>{{user.name + " - " + user.age}}</text><view class="{{isActive ? \'active\' : \'inactive\'}}">内容</view>',
  '<view class="{{item.status === \'active\' ? (item.type === \'vip\' ? \'vip-active\' : \'normal-active\') : \'inactive\'}}"><text>{{item.data && item.data.user ? item.data.user.name : \'未知用户\'}}</text></view>',
  '<view><image src="{{avatar}}" mode="aspectFit"></image><input type="text" placeholder="请输入"></input><icon type="success" size="20"></icon></view>',
  '<scroll-view scroll-y="true" class="scroll-area"><swiper indicator-dots="{{true}}" autoplay="{{false}}" interval="{{5000}}"><swiper-item><image src="{{item.url}}" mode="aspectFill"></image></swiper-item></swiper></scroll-view>',
  '<form bind:submit="onSubmit"><input name="username" placeholder="用户名" value="{{form.username}}" bind:input="onInput"/><textarea name="content" placeholder="请输入内容" value="{{form.content}}" bind:input="onTextareaInput"></textarea><button form-type="submit">提交</button></form>',
  '<view class="container"><view class="header"><text class="title">标题</text></view><view class="content"><view class="item"><text>项目1</text></view><view class="item"><text>项目2</text></view></view></view>',
  '<view class="very-long-class-name-that-makes-the-tag-exceed-100-characters" data-id="12345" style="color: red;">内容</view>',
]

const upstreamExampleMaterials = [
  '<!-- 复杂的WXML示例 --><view class="page"><view class="header" wx:if="{{showHeader}}"><text class="title">{{pageTitle}}</text><button bind:tap="onBack" class="back-btn">返回</button></view><scroll-view scroll-y="true" class="content"><view wx:for="{{dataList}}" wx:key="id" wx:for-item="item" wx:for-index="idx" class="item-container"><view class="item-header"><text class="item-title">{{item.title}}</text><text wx:if="{{item.isNew}}" class="new-tag">新</text></view><view class="item-content"><text class="description">{{item.description}}</text><image wx:if="{{item.imageUrl}}" src="{{item.imageUrl}}" class="item-image" bind:tap="onImageTap" data-url="{{item.imageUrl}}"/></view><view class="item-actions"><button wx:if="{{item.canEdit}}" bind:tap="onEdit" data-id="{{item.id}}" class="edit-btn">编辑</button><button bind:tap="onDelete" data-id="{{item.id}}" class="delete-btn" wx:if="{{item.canDelete}}">删除</button></view></view><view wx:if="{{dataList.length === 0}}" class="empty-state"><text>暂无数据</text></view></scroll-view><view class="footer"><button bind:tap="onAdd" class="add-btn">添加新项目</button></view></view>',
  '<view class="container"><text wx:if="{{user.isVip}}">VIP用户</text><text wx:elif="{{user.isActive}}">活跃用户</text><text wx:else>普通用户</text><view wx:if="{{showDetails}}"><text>详细信息：{{user.details}}</text><button wx:if="{{canEdit}}" bind:tap="onEdit">编辑</button></view></view>',
  '<view class="event-demo"><button bind:tap="onTap" data-id="{{item.id}}">普通点击</button><button catch:tap="onCatchTap" class="catch-btn">阻止冒泡点击</button><view capture-bind:touchstart="onCaptureStart" capture-catch:touchend="onCaptureEnd" class="capture-area"><text>捕获事件区域</text><button bind:longpress="onLongPress" bind:touchstart="onTouchStart" bind:touchend="onTouchEnd">多事件按钮</button></view></view>',
  '<view class="expressions"><text>用户名：{{user.name || \'未知用户\'}}</text><text>年龄：{{user.age > 18 ? \'成年\' : \'未成年\'}}</text><view class="{{isActive ? \'active\' : \'inactive\'}} {{user.vip ? \'vip\' : \'\'}}">状态显示</view><text>计算结果：{{(price * quantity * (1 - discount)).toFixed(2)}}</text><image src="{{baseUrl + \'/images/\' + user.avatar}}" class="avatar"/></view>',
  '<view class="list-container"><view wx:for="{{categories}}" wx:key="id" wx:for-item="category" class="category"><text class="category-title">{{category.name}}</text><view wx:for="{{category.items}}" wx:key="itemId" wx:for-item="item" wx:for-index="itemIndex" class="item"><text>{{itemIndex + 1}}. {{item.title}}</text><text class="price">¥{{item.price}}</text></view></view></view>',
  '<view class="container"><text wx:if="{{user.isVip}}">VIP用户</text><text wx:elif="{{user.isActive}}">活跃用户</text><text wx:else>普通用户</text><view wx:if="{{showDetails}}"><text>详细信息：{{user.details}}</text><button wx:if="{{canEdit}}" bind:tap="onEdit">编辑</button></view><image src="{{user.avatar}}" class="avatar" mode="aspectFit" bind:tap="onImageTap"></image><button wx:if="{{item.canEdit}}" bind:tap="onEdit" data-id="{{item.id}}" class="edit-btn" disabled="{{loading}}">编辑按钮</button></view>',
  '<view class="container"><text wx:if="{{show}}">Hello World</text><button bind:tap="onTap" class="btn">Click Me</button><view wx:for="{{list}}" wx:key="id" wx:for-item="item" wx:for-index="index"><text>{{item.name}}</text></view></view>',
  '<text class="asda" tabindex assdassd asd>asdasdasdsaaszdasd asdasdasd asdasd asd asd asd asd asd asd asd a</text>\n\n<text class="asda" tabindex assdassd asd>asdasdasdsaaszdasd asdasdasd asdasd asd asd asd asd asd asd asd a</text>\n\n<view class="container" data-id="123" bind:tap="handleTap">Some text content here</view>',
  '<!-- 测试 text 标签多属性换行 -->\n\n<!-- 测试1: 3个属性 -->\n<text class="title" data-id="123" bind:tap="handleTap">这是文本内容</text>\n\n<!-- 测试2: 4个属性 -->\n<text class="asda" tabindex assdassd asd>asdasdasdsaaszdasd asdasdasd asdasd asd asd asd asd asd asd asd a</text>\n\n<!-- 测试3: 长内容 -->\n<text class="a" data-id="b" style="color:red">这是一段很长很长很长很长很长很长的文本内容</text>\n\n<!-- 对比: view 标签 3个属性 -->\n<view class="container" data-id="123" bind:tap="handleTap">这是内容</view>\n\n<!-- 对比: button 标签 4个属性 -->\n<button class="btn" data-id="123" bind:tap="handleTap" disabled>按钮文本</button>',
]

const platformSyntaxCases = [
  {
    platform: 'weapp',
    input: '<view wx:if="{{count > 0}}" bindtap="onTap" mark:item-id="{{item.id}}">微信</view>',
  },
  {
    platform: 'alipay',
    input: '<view a:if="{{count > 0}}" onTap="onTap"><import-sjs name="helper" from="./helper.sjs" /></view>',
  },
  {
    platform: 'tt',
    input: '<view tt:if="{{count > 0}}" bindtap="onTap"><sjs module="helper">module.exports = { bigger: (a, b) => a > b }</sjs></view>',
  },
  {
    platform: 'swan',
    input: '<view s-if="{{count > 0}}" bindtap="onTap"><filter module="helper">export default { bigger(a, b) { return a > b } }</filter></view>',
  },
  {
    platform: 'qq',
    input: '<view qq:if="{{count > 0}}" bindtap="onTap">QQ</view>',
  },
  {
    platform: 'jd',
    input: '<view jd:if="{{count > 0}}" bindtap="onTap">京东</view>',
  },
  {
    platform: 'ks',
    input: '<view ks:if="{{count > 0}}" bindtap="onTap">快手</view>',
  },
  {
    platform: 'xhs',
    input: '<view xhs:if="{{count > 0}}" bindtap="onTap">小红书</view>',
  },
  {
    platform: 'ty',
    input: '<view ty:if="{{count > 0}}" bindtap="onTap">涂鸦</view>',
  },
]

describe('formatWxmlText', () => {
  for (const testCase of exactCases) {
    it(testCase.name, () => {
      assert.equal(format(testCase.input), testCase.expected)
    })
  }

  it('formats the formatter-wxml script cases without corrupting expressions or directives', () => {
    for (const input of upstreamScriptCases) {
      const output = format(input)

      assert.equal(output.includes('undefined'), false)
      assert.equal(output.includes('__WEAPP_VITE_WXML_'), false)
      assert.match(output, /\n$/u)
    }
  })

  it('formats all formatter-wxml example materials without placeholder leakage', () => {
    for (const input of upstreamExampleMaterials) {
      const output = format(input)

      assert.equal(output.includes('undefined'), false)
      assert.equal(output.includes('__WEAPP_VITE_WXML_'), false)
      assert.match(output, /<[\w-]+|<!--/u)
      assert.match(output, /\n$/u)
    }
  })

  it('preserves significant text whitespace and comparison operators inside expressions', () => {
    const input = '<view title="{{count > 0 ? \'a > b\' : \'c\'}}">A  B {{ count < limit ? \'<\' : \'>\' }}</view>'
    const output = format(input)

    assert.match(output, /title="\{\{count > 0 \? 'a > b' : 'c'\}\}"/u)
    assert.match(output, />A {2}B \{\{ count < limit \? '<' : '>' \}\}<\/view>/u)
    assert.equal(format(output), output)
  })

  it('keeps mixed text and nested tags semantically unchanged', () => {
    const input = '<view>Hello  <text>{{name}}</text>, welcome back.</view>'

    assert.equal(format(input), `${input}\n`)
  })

  it('preserves inline script modules as opaque source', () => {
    const script = `const compare = (a, b) => a < b && "a  b" !== "a b"
module.exports = { compare }`
    const input = `<wxs module="tools">${script}</wxs><view wx:if="{{tools.compare(a, b)}}">ok</view>`
    const output = format(input)

    assert.match(output, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'))
    assert.match(output, /<view wx:if="\{\{tools\.compare\(a, b\)\}\}">ok<\/view>/u)
    assert.equal(format(output), output)
  })

  it('does not terminate script modules on closing-tag text inside strings', () => {
    const input = '<wxs module="tools">const marker = "</wxs>"; module.exports = { marker }</wxs><view>{{tools.marker}}</view>'
    const output = format(input)

    assert.match(output, /const marker = "<\/wxs>"; module\.exports = \{ marker \}<\/wxs>/u)
    assert.match(output, /\n<view>\{\{tools\.marker\}\}<\/view>\n$/u)
    assert.equal(format(output), output)
  })

  it('preserves nested object literals and unquoted Mustache attributes', () => {
    const input = '<view data-state={{ ({ ok: count > 0, nested: { value: count } }).nested.value }}>{{ ({ left: "<", right: ">" }).left }}</view>'
    const output = format(input)

    assert.match(output, /data-state=\{\{ \(\{ ok: count > 0, nested: \{ value: count \} \}\)\.nested\.value \}\}/u)
    assert.match(output, />\{\{ \(\{ left: "<", right: ">" \}\)\.left \}\}<\/view>/u)
    assert.equal(format(output), output)
  })

  it('keeps top-level Mustache text idempotent without accumulating blank lines', () => {
    const input = '<import src="/shared.wxml"/>\n{{a}}{{b}}{{sum}}\n<button bindtap="add">Add</button>'
    const output = format(input)

    assert.equal(output, '<import src="/shared.wxml" />\n{{a}}{{b}}{{sum}}\n<button bindtap="add">Add</button>\n')
    assert.equal(format(output), output)
  })

  it('preserves declarations, CDATA and conditional compilation comments', () => {
    const input = '<?xml version="1.0"?><![CDATA[a < b && c > d]]><!-- #ifdef WEAPP --><view>微信</view><!-- #endif -->'
    const output = format(input)

    assert.match(output, /^<\?xml version="1\.0"\?>\n<!\[CDATA\[a < b && c > d\]\]>\n<!-- #ifdef WEAPP -->/u)
    assert.match(output, /<!-- #endif -->\n$/u)
  })

  it('covers platform directives, events and script-module syntax without rewriting them', () => {
    for (const testCase of platformSyntaxCases) {
      const output = format(testCase.input)

      assert.equal(output.includes('undefined'), false, testCase.platform)
      assert.equal(output.includes('__WEAPP_VITE_WXML_'), false, testCase.platform)
      assert.equal(format(output), output, testCase.platform)
      for (const attribute of testCase.input.match(/[\w-]+(?::[\w-]+)?="[^"]*"/gu) ?? []) {
        assert.equal(output.includes(attribute), true, `${testCase.platform}: ${attribute}`)
      }
    }
  })

  it('returns malformed or ambiguous templates unchanged', () => {
    const cases = [
      '<view><text>missing close</view>',
      '<view title="unterminated>content</view>',
      '<!-- unterminated comment',
      '<wxs module="tools">const value = 1',
    ]

    for (const input of cases) {
      assert.equal(format(input), input)
    }
  })
})
