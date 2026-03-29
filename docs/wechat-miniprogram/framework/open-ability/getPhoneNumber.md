<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html -->

# 手机号快速验证组件

该能力旨在帮助开发者向用户发起手机号申请，并且 **必须经过用户同意后** ，开发者才可获得由平台验证后的手机号，进而为用户提供相应服务。

该能力与 [手机号实时验证组件](./getRealtimePhoneNumber/README.md) 的区别为：

1. 手机号快速验证组件，平台会对号码进行验证，但 **不保证是实时验证** ；
2. 手机号实时验证组件， **在每次请求时，平台均会对用户选择的手机号进行实时验证** 。

**请注意：**

1. 目前该接口针对 **非个人主体，且完成了认证的小程序开放（境外主体目前仅限部分国家地区开放， [详见文档](https://docs.qq.com/doc/DZWpqblRwU3labktJ) ）** ；
2. 该能力使用时，用户可选择绑定号码，或自主添加号码。平台会基于中国三大运营商提供的短信等底层能力对号码进行验证，但 **不保证是实时验证** ；
3. 请开发者根据业务场景需要自行判断并选择是否使用，必要时可考虑增加其他安全验证手段。
4. 开发者需合理使用，若被发现或用户举报开发者 **不合理地** 要求用户提供手机号等个人信息，中断了正常的使用流程，影响了用户的使用体验， **微信有权依据 [《微信小程序平台运营管理规范》](https://developers.weixin.qq.com/miniprogram/product/#_15-%E7%94%A8%E6%88%B7%E9%9A%90%E7%A7%81%E5%92%8C%E6%95%B0%E6%8D%AE%E8%A7%84%E8%8C%83) 对该小程序进行处理** 。 [常见违规事例和具体解析](https://mp.weixin.qq.com/s/0c3WUmL_tV77Ue0XwsR-Vg) ；

## 收费说明

自2023年8月28日起，手机号快速验证组件将需要付费使用。标准单价为：每次组件调用成功，收费0.03元。更多套餐价格请见 [微信公众平台-付费管理](https://mp.weixin.qq.com/cgi-bin/loginpage?redirect_url=/wxamp/wxacharge) 。

[购买操作指引](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/charge/)

[常见问题解答](https://docs.qq.com/doc/DZXFIVVRYb2JXaVVn)

**请注意：**

1. 体验额度：每个小程序账号将有1000次体验额度，用于开发、调试和体验。该1000次的体验额度为正式版、体验版和开发版小程序共用，超额后，体验版和开发版小程序调用同正式版小程序一样，均收费；
2. 资源包有效期：在2023年8月28日前购买的订单，资源包将于2023年8月28日生效；在2023年8月28日后购买的订单，资源包将于支付成功后即刻生效；各资源包将按购买时所选择的有效期，计算相应的到期失效时间；
3. 资源使用顺序：默认先从体验额度中划扣，划扣完毕后再从付费资源包中划扣；若有多个付费资源包，将按资源包到期时间顺序，先从最近到期的资源包开始划扣，如此类推；
4. 退款规则：若购买有误，且未正式开始使用资源包前，可以在支付成功后的7天内申请退款。款项将在3-5个工作日内从原支付路径返回；若资源包已经开始使用（使用1次及以上），则不能申请退款；若支付成功后超过7天，未发起退款申请，亦不能再申请退款。
5. 异常排查：若对调用量有疑问，可参考 [《手机号计费误差问题排查指南》](./PhoneNumberGuide.md) 进行排查。

#### 免费规则

符合以下情况之一的小程序，使用此能力不收费，具体如下：

1. 账号 [微信认证主体类型](https://kf.qq.com/faq/120911VrYVrA141021aUZJzY.html) 为政府、非营利组织的小程序；
2. 账号 [微信认证主体类型](https://kf.qq.com/faq/120911VrYVrA141021aUZJzY.html) 为事业单位，且类目为政务民生的小程序;
3. 账号类目为公立医疗机构、学历教育（学校）的小程序

开发者可通过以下两种方式查询小程序的微信认证主体类型：

1. 进入「 [微信公众平台](./mp.weixin.qq.com/README.md) ->点击小程序信息->查看基本信息->微信认证主体类型」
2. 进入「 [微信公众平台](./mp.weixin.qq.com/README.md) ->点击右上角账号头像->可查看基本信息->微信认证主体类型」

#### 集采模式

旨在提供更高效的落地工具，支持批量采购资源包后，可以灵活地分配给多个小程序使用。集采模式 [接入指引](https://developers.weixin.qq.com/doc/oplatform/service_market/charge/guide/intro.html) 。

### 查询和扣费节点说明

- 查询节点：用户点击button时，进行资源包额度查询。若查询额度不足，开发者将收到错误码 `e.detail.errno===1400001` ，同时用户侧将收到平台默认半屏提示“该功能使用次数已达当前小程序上限，暂时无法使用”。若开发者想自行兼容欠费逻辑，可将 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件中 `phone-number-no-quota-toast` 的值设置为 `false` ，此时平台将不在用户侧进行提示；
- 扣费节点：开发者获得 `bindgetphonenumber` 事件的 success 回调信息时，进行扣费。

## 使用方法

**步骤1** ：需要将 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件 `open-type` 的值设置为 `getPhoneNumber` ，当用户点击并同意之后，通过 `bindgetphonenumber` 事件获取回调信息；

**步骤2** ：将 `bindgetphonenumber` 事件回调中的动态令牌 `code` 传到开发者后台，并在开发者后台调用微信后台提供的 [phonenumber.getPhoneNumber](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/phonenumber/phonenumber.getPhoneNumber.html) 接口，消费 `code` 来换取用户手机号。每个 `code` 有效期为5分钟，且只能消费一次。

注： `getPhoneNumber` 返回的 `code` 与 `wx.login` 返回的 `code` 作用是不一样的，不能混用。

**注意**

从基础库2.21.2开始，对步骤2中换取手机号信息的方式进行了安全升级，上述为新方式使用指南。（ [旧方式](./deprecatedGetPhoneNumber.md) 目前可以继续使用，但 **建议开发者使用新方式，以增强小程序安全性** ）另外，新方式 **不再** 需要提前调用 `wx.login` 进行登录。

## 代码示例

```html
<button open-type="getPhoneNumber" bindgetphonenumber="getPhoneNumber"></button>
```

```js
Page({
  getPhoneNumber (e) {
    console.log(e.detail.code)  // 动态令牌
    console.log(e.detail.errMsg) // 回调信息（成功失败都会返回）
    console.log(e.detail.errno)  // 错误码（失败时返回）
  }
})
```

## 返回参数说明

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>code</td> <td>String</td> <td>动态令牌。可通过动态令牌换取用户手机号。使用方法详情 <a href="https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/phonenumber/phonenumber.getPhoneNumber.html" target="_blank" rel="noopener noreferrer">phonenumber.getPhoneNumber<span></span></a> 接口</td> <td></td></tr></tbody></table>
