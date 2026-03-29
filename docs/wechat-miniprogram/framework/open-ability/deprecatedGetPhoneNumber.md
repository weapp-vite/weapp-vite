<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/deprecatedGetPhoneNumber.html -->

# 手机号快速验证组件

该能力旨在帮助开发者向用户发起手机号申请，并且必须经过用户同意后，开发者才可获得由平台验证后的手机号，进而为用户提供相应服务。

以下是旧版本组件使用指南，注意使用旧版本组件时，需先调用 [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) 接口。建议开发者使用新版本组件，以增强小程序安全性。详情 [新版组件使用指南](./getPhoneNumber.md) 。

因为需要用户主动触发才能发起手机号快速验证，所以该功能不由 API 来调用，需用 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件的点击来触发。

**注意**

- **1. 目前该接口针对非个人开发者，且完成了认证的小程序开放（不包含海外主体）。需谨慎使用，若用户举报较多或被发现在不必要场景下使用，微信有权永久回收该小程序的该接口权限。**
- **2. 该能力使用时，用户可选择绑定号码，或自主添加号码。平台会对号码进行验证，但不保证是实时验证；**
- **3. 请开发者根据业务场景需要自行判断并选择是否使用，必要时可考虑增加其他安全验证手段。**

## 使用方法

需要将 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件 `open-type` 的值设置为 `getPhoneNumber` ，当用户点击并同意之后，可以通过 `bindgetphonenumber` 事件回调获取到微信服务器返回的加密数据， 然后在第三方服务端结合 `session_key` 以及 `app_id` 进行解密获取手机号。

## 注意事项

在回调中调用 [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) 登录，可能会刷新登录态。此时服务器使用 code 换取的 sessionKey 不是加密时使用的 sessionKey，导致解密失败。建议开发者提前进行 `login` ；或者在回调中先使用 `checkSession` 进行登录态检查，避免 `login` 刷新登录态。

## 代码示例

```html
<button open-type="getPhoneNumber" bindgetphonenumber="getPhoneNumber"></button>
```

```js
Page({
  getPhoneNumber (e) {
    console.log(e.detail.errMsg)
    console.log(e.detail.iv)
    console.log(e.detail.encryptedData)
  }
})
```

## 返回参数说明

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>encryptedData</td> <td>String</td> <td>包括敏感数据在内的完整用户信息的加密数据，详细见<a href="signature.html#%E5%8A%A0%E5%AF%86%E6%95%B0%E6%8D%AE%E8%A7%A3%E5%AF%86%E7%AE%97%E6%B3%95">加密数据解密算法</a></td> <td></td></tr> <tr><td>iv</td> <td>String</td> <td>加密算法的初始向量，详细见<a href="signature.html#%E5%8A%A0%E5%AF%86%E6%95%B0%E6%8D%AE%E8%A7%A3%E5%AF%86%E7%AE%97%E6%B3%95">加密数据解密算法</a></td> <td></td></tr> <tr><td>cloudID</td> <td>string</td> <td>敏感数据对应的云 ID，开通云开发的小程序才会返回，可通过云调用直接获取开放数据，详细见<a href="signature.html#method-cloud">云调用直接获取开放数据</a></td> <td>基础库 <a href="../compatibility.html">2.8.0</a></td></tr></tbody></table>

获取得到的开放数据为以下 json 结构：

```json
{
    "phoneNumber": "13580006666",
    "purePhoneNumber": "13580006666",
    "countryCode": "86",
    "watermark":
    {
        "appid":"APPID",
        "timestamp": TIMESTAMP
    }
}
```

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>phoneNumber</td> <td>String</td> <td>用户绑定的手机号（国外手机号会有区号）</td></tr> <tr><td>purePhoneNumber</td> <td>String</td> <td>没有区号的手机号</td></tr> <tr><td>countryCode</td> <td>String</td> <td>区号</td></tr></tbody></table>
