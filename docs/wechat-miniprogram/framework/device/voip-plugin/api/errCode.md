<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/errCode.html -->

# VoIP 插件错误码

## 1. 后台返回错误码

<table><thead><tr><th>errCode</th> <th>描述</th></tr></thead> <tbody><tr><td>1</td> <td>roomId 错误</td></tr> <tr><td>2</td> <td>设备 deviceId 错误</td></tr> <tr><td>3</td> <td>voip_id 错误</td></tr> <tr><td>4</td> <td>voipToken 错误 (刷脸模式)</td></tr> <tr><td>5</td> <td>生成 voip 房间错误</td></tr> <tr><td>7</td> <td>openId 错误</td></tr> <tr><td>8</td> <td>openId 未授权（刷脸模式）</td></tr> <tr><td>9</td> <td>openId 未授权设备(硬件模式) 或不是 userId 联系人（刷脸模式）</td></tr> <tr><td>12</td> <td>小程序音视频能力审核未完成，正式版中暂时无法使用</td></tr> <tr><td>13</td> <td>硬件设备拨打微信，voipToken 错误</td></tr> <tr><td>14</td> <td>微信拨打硬件设备，voipToken 错误</td></tr> <tr><td>15</td> <td>欠费</td></tr> <tr><td>17</td> <td>voipToken 对应 modelId 错误</td></tr> <tr><td>19</td> <td>openId 与小程序 appId 不匹配。（同一个用户在不同小程序的 openId 不同）</td></tr> <tr><td>20</td> <td>openId 无效</td></tr> <tr><td>22</td> <td>传入的 chargeType 非法</td></tr> <tr><td>23</td> <td>当前设备 license 已过期</td></tr> <tr><td>24</td> <td>当前设备未激活 license</td></tr></tbody></table>

## 2. 插件内部错误码

> 已插件最新版本支持为准

<table><thead><tr><th>errCode</th> <th>描述</th></tr></thead> <tbody><tr><td>1000</td> <td>使用 WMPF 注册设备时，deviceToken 获取失败</td></tr> <tr><td>1001</td> <td>voipToken 为空或类型错误（仅在要求传入的情况）</td></tr> <tr><td>1002</td> <td>CGI 请求失败</td></tr> <tr><td>1003</td> <td>CGI 返回值解析失败</td></tr> <tr><td>1004</td> <td>接口调用参数错误</td></tr> <tr><td>1005</td> <td>插件当前正在处理其他通话</td></tr> <tr><td>1006</td> <td>当前接口必须在 WMPF 使用</td></tr> <tr><td>1007</td> <td>当前接口必须在微信客户端使用</td></tr> <tr><td>1008</td> <td>通话被中断，具体原因需查看 errMsg</td></tr> <tr><td>1011</td> <td>当前平台不支持该功能</td></tr> <tr><td>2000</td> <td>加入房间失败，具体原因需查看 errMsg</td></tr> <tr><td>2001</td> <td>加入房间失败：当前有其他小程序 VoIP 通话正在进行</td></tr> <tr><td>2002</td> <td>加入房间失败：SDK 重置失败</td></tr> <tr><td>2003</td> <td>加入房间失败：SDK 初始化失败</td></tr> <tr><td>2004</td> <td>加入房间失败：SDK 加入房间失败</td></tr> <tr><td>2005</td> <td>加入房间失败：join 回调失败</td></tr> <tr><td>2006</td> <td>加入房间失败：talk 回调失败</td></tr> <tr><td>2007</td> <td>加入房间失败：调用音视频设备失败（如无法启用麦克风等）</td></tr> <tr><td>2008</td> <td>加入房间失败：获取 sessionKey 失败</td></tr> <tr><td>2009</td> <td>加入房间失败：已取消或小程序退后台</td></tr> <tr><td>2010</td> <td>加入房间失败：join CGI 请求失败</td></tr> <tr><td>2100</td> <td>加入房间失败：当前有其他微信好友 VoIP 或系统电话正在进行</td></tr> <tr><td>2102</td> <td>加入房间失败：无访问音视频设备的权限（如录音权限等）</td></tr> <tr><td>2103</td> <td>加入房间失败：无调用 JSAPI 的权限</td></tr> <tr><td>2104</td> <td>加入房间失败：其他 CGI 异常，具体原因需查看 errMsg</td></tr></tbody></table>

## 3. Error 类

> 需插件 2.4.0 版本开始支持

### 3.1 VoipError

插件抛出异常的基类，继承自 `Error` ，并增加下列属性：

<table><thead><tr><th>属性名</th> <th>类型</th> <th>简介</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr> <tr><td>errCode</td> <td>number</td> <td>错误码</td></tr> <tr><td>errno</td> <td>number</td> <td>基础库接口返回的 errno</td></tr> <tr><td>cause</td> <td>unknown</td> <td>如果错误本身是其他错误引起的，这里包含原始的错误对象</td></tr></tbody></table>

### 3.2 VoipCgiError

后台请求失败错误，继承自 `VoipError` ，仅作类型区分，无新增属性。

### 3.3 VoipJoinError

加入房间失败相关错误，继承自 `VoipError` ，并增加下列属性：

> 这两个属性开发者一般不需关注，仅微信侧排查问题需要

<table><thead><tr><th>属性名</th> <th>类型</th> <th>简介</th></tr></thead> <tbody><tr><td>extErrMsg</td> <td>string</td> <td><code>wx.joinVoipChat</code> 报错里额外的信息</td></tr> <tr><td>errType</td> <td>number</td> <td><code>wx.joinVoipChat</code> 报错返回的 errType</td></tr></tbody></table>

### 3.4 VoipPluginError

插件内其他类型的错误，继承自 `VoipError` ，仅作类型区分，无新增属性。
