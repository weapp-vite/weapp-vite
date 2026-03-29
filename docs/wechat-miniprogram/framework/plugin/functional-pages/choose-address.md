<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/choose-address.html -->

# 收货地址功能页

从基础库版本 [2.16.1](../../compatibility.md) 起，该功能页已经废弃，可以直接使用 [`wx.chooseAddress`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/address/wx.chooseAddress.html) 实现对应的功能；点击 `functional-page-navigator` 也将不再进入功能页，直接进入收货地址选择页。

文档

收货地址功能页用于展示用户的收货地址列表，用户可以选择其中的收货地址。自基础库版本 [2.4.0](../../compatibility.md) 开始支持。

## 调用参数

用户信息功能页使用 [functional-page-navigator](https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html) 进行跳转时，对应的参数 name 应为固定值 `chooseAddress` ，返回参数与 [wx.chooseAddress](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/address/wx.chooseAddress.html) 相同。

**bindsuccess 返回参数说明：**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>userName</td> <td>string</td> <td>收货人姓名</td> <td></td></tr> <tr><td>postalCode</td> <td>string</td> <td>邮编</td> <td></td></tr> <tr><td>provinceName</td> <td>string</td> <td>国标收货地址第一级地址</td> <td></td></tr> <tr><td>cityName</td> <td>string</td> <td>国标收货地址第一级地址</td> <td></td></tr> <tr><td>countyName</td> <td>string</td> <td>国标收货地址第一级地址</td> <td></td></tr> <tr><td>detailInfo</td> <td>string</td> <td>详细收货地址信息</td> <td></td></tr> <tr><td>nationalCode</td> <td>string</td> <td>收货地址国家码</td> <td></td></tr> <tr><td>telNumber</td> <td>string</td> <td>收货人手机号码</td> <td></td></tr> <tr><td>errMsg</td> <td>string</td> <td>错误信息</td> <td></td></tr></tbody></table>

## 示例代码

```html
<!--plugin/components/hello-component.wxml-->
  <functional-page-navigator
    name="chooseAddress"
    version="develop"
    bind:success="onSuccess"
    bind:fail="onFail"
  >
    <button>选择收货地址</button>
  </functional-page-navigator>
```

```javascript
// plugin/components/hello-component.js
Component({
  methods: {
    onSuccess: function (res) {
      console.log(res.detail);
    },
    onFail: function (res) {
      console.log(res);
    }
  }
});
```
