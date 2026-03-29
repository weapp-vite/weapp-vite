<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/forceHangUpVoip.html -->

# void forceHangUpVoip([string roomId])

强制结束通话

## 参数

### String roomId

可选。2.3.2 开始支持。

- 不传入时，挂断当前正在进行的通话；
- 传入时，仅在当前通话 roomId 与传入相同时，挂断当前正在进行的通话。（建议）

## 返回值

无

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

wmpfVoip.forceHangUpVoip('some group id')
```
