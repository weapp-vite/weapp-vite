<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/setCustomBtnText.html -->

# void setCustomBtnText(String btnText)

若需要微信接听方在通话页面中进行其他操作，插件提供了可自定义文案的按钮。 **仅限微信客户端接听，且通话开始后展示自定义按钮。**

按钮点击后将会弹出包含开发者自定义内容的半屏容器，自定义的内容需要以 [小程序自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/(framework/custom-component/)) 的形式提供。

## 参数

### String btnText

按钮文案

## 返回值

无

## 设置按钮点击后展示的内容

在 `app.json` 中插件配置 `genericsImplementation` 字段传入自定义组件的路径（ `call-page-plugin` 和 `custombox` 为固定值）。

```json
{
  "plugins": {
    "wmpf-voip": {
      "version": "latest",
      "provider": "wxf830863afde621eb",
      "genericsImplementation": {
        "call-page-plugin": {
          "custombox": "path/to/customComponents" // 要显示的自定义组件路径
        }
      }
    }
  }
}
```

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default
wmpfVoip.setCustomBtnText('去开门')
```
