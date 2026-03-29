<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/getIotBindContactList.html -->

# getIotBindContactList(Object req)

> 本接口为异步接口，返回 `Promise` 对象。

根据 openId，查询指定用户是否授权某台设备。

## 参数

### Object req

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>sn</td> <td>string</td> <td></td> <td>是</td> <td>设备 SN</td></tr> <tr><td>model_id</td> <td>string</td> <td></td> <td>是</td> <td>设备的 model_id</td></tr> <tr><td>openid_list</td> <td>string[]</td> <td></td> <td>是</td> <td>要查询的用户 openId 列表</td></tr></tbody></table>

## 返回值

### Object

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errcode</td> <td>number</td> <td>错误码</td></tr> <tr><td>errmsg</td> <td>string</td> <td>错误信息</td></tr> <tr><td>contact_list</td> <td>Info[]</td> <td>openid 授权信息，status: 1 表示已授权，0 表示未授权</td></tr></tbody></table>

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

wmpfVoip
  .getIotBindContactList({
    sn: '设备sn',
    model_id: '申请的modelid',
    openid_list: ['openid_1', 'openid_2'], // 传入需要验证的openid列表
  })
  .then(res => {
    console.log(`[getIotBindContactList]:`, res.contact_list)
    // [{sn: 'xxx', model_id: 'xxx', status: 0}]
    // status: 0/未授权；1/已授权
  })
```
