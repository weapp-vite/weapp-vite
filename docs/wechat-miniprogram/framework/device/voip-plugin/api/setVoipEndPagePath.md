<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/setVoipEndPagePath.html -->

# void setVoipEndPagePath(Object req)

设置插件功能执行完成后的跳转页面路径。

## 参数

### Object req

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>url</td> <td>string</td> <td></td> <td>是</td> <td>跳转页面的路径</td> <td></td></tr> <tr><td>key</td> <td>string</td> <td></td> <td>是</td> <td>业务类型，参见下文</td> <td></td></tr> <tr><td>options</td> <td>string</td> <td></td> <td>否</td> <td>跳转页面的 queryString。最终跳转的路径为 <code>url + '?' + options</code></td> <td></td></tr> <tr><td>routeType</td> <td>string</td> <td>redirectTo</td> <td>否</td> <td>页面跳转的方式，取值有：redirectTo/switchTab/reLaunch</td> <td>2.3.9</td></tr></tbody></table>

**业务类型**

key 参数有以下取值

- `Call` ：设置通话结束后跳转的页面路径， **需保证在通话结束前设置** 。
- `BindContact` ：设置联系人绑定关系页面操作完成后要跳转的页面路径。仅用于 [校园场景支付刷脸模式](../wxpay.md) 。

## 返回值

无

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

// 可根据 typeof wmpf !== 'undefined' 判断是否是设备端跳转不同页面
wmpfVoip.setVoipEndPagePath({
  url: '/pages/contactList/contactList',
  options: 'param1=xxx&param2=xxx',
  key: 'Call',
})
```
