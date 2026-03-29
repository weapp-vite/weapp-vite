<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/getPluginOnloadOptions.html -->

# Object getPluginOnloadOptions()

> 插件 2.2.3 版本开始支持

获取 **插件通话页面打开(onLoad)时** 页面路径中的参数。

注意：获取参数时，如果插件通话页面onLoad还没有触发，可能取到的不是最新的值。 **建议在 `callPageOnShow` 事件后调用。**

## 参数

无

## 返回值

### Object

插件页面 [onLoad 生命周期的 query 参数](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onLoad-Object-query)

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

let query = {}

wmpfVoip.onVoipEvent((event) => {
  if (event.eventName === 'callPageOnShow') {
    query = wmpfVoip.getPluginOnloadOptions()
  }
})
```
