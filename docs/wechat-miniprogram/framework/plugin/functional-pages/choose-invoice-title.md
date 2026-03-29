<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/choose-invoice-title.html -->

# 发票抬头功能页

从基础库版本 [2.16.1](../../compatibility.md) 起，该功能页已经废弃，可以直接使用 [`wx.chooseInvoiceTitle`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/invoice/wx.chooseInvoiceTitle.html) 实现对应的功能；点击 `functional-page-navigator` 也将不再进入功能页，直接进入发票抬头选择页。

文档

发票抬头功能页用于展示用户的发票抬头列表，用户可以选择其中的发票抬头。自基础库版本 [2.14.1](../../compatibility.md) 开始支持。

## 调用参数

发票抬头功能页使用 [functional-page-navigator](https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html) 进行跳转时，对应的参数 name 应为固定值 `chooseInvoiceTitle` ，返回参数与 [wx.chooseInvoiceTitle](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/invoice/wx.chooseInvoiceTitle.html) 相同。

**bindsuccess 返回参数说明：**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>type</td> <td>string</td> <td>抬头类型</td></tr> <tr><td>title</td> <td>string</td> <td>抬头名称</td></tr> <tr><td>taxNumber</td> <td>string</td> <td>抬头税号</td></tr> <tr><td>companyAddress</td> <td>string</td> <td>单位地址</td></tr> <tr><td>telephone</td> <td>string</td> <td>手机号码</td></tr> <tr><td>bankName</td> <td>string</td> <td>银行名称</td></tr> <tr><td>bankAccount</td> <td>string</td> <td>银行账号</td></tr> <tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

**res.type 的合法值**

<table><thead><tr><th>值</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>0</td> <td>单位</td> <td></td></tr> <tr><td>1</td> <td>个人</td> <td></td></tr></tbody></table>

## 示例代码

```html
<!--plugin/components/hello-component.wxml-->
  <functional-page-navigator
    name="chooseInvoiceTitle"
    version="develop"
    bind:success="onSuccess"
    bind:fail="onFail"
  >
    <button>选择发票抬头</button>
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
