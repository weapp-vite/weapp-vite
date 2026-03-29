<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/ocr.html -->

# OCR检测

VisionKit从基础库 2.27.0版本开始提供OCR能力。

## 方法定义

OCR检测有2种使用方法，一种是输入一张静态图片进行检测，另一种是通过摄像头实时检测。

### 1. 静态图片检测

通过 [VKSession.runOCR 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.runOCR.html) 输入一张图像，算法检测到图像中的文字，然后通过 [VKSession.on 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.on.html) 输出获取的文字内容。

示例代码：

```js
const session = wx.createVKSession({
  track: {
    OCR: { mode: 2 } // mode: 1 - 使用摄像头；2 - 手动传入图像
  },
})

// 静态图片检测模式下，每调一次 runOCR 接口就会触发一次 updateAnchors 事件
session.on('updateAnchors', anchors => {
  console.log('anchors.text', "".concat(anchors.map(anchor=>anchor.text)))
})

// 需要调用一次 start 以启动
session.start(errno => {
  if (errno) {
    // 如果失败，将返回 errno
  } else {
    // 否则，返回null，表示成功
    session.runOCR({
      frameBuffer, // 图片 ArrayBuffer 数据。待检测图像的像素点数据，每四项表示一个像素点的 RGBA
      width, // 图像宽度
      height, // 图像高度
    })
  }
})
```

### 2. 通过摄像头实时检测

算法实时检测相机中的文字内容，通过 [VKSession.on 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.on.html) 实时输出文字。

示例代码：

```js
const session = wx.createVKSession({
  track: {
    OCR: { mode: 1 } // mode: 1 - 使用摄像头；2 - 手动传入图像
  },
})

// 摄像头实时检测模式下，监测到文字时，updateAnchors 事件会连续触发 （每帧触发一次）
session.on('updateAnchors', anchors => {
  console.log('anchors.text',"".concat(anchors.map(anchor=>anchor.text)))
})

// 当文字区域从相机中离开时，会触发 removeAnchors 事件
session.on('removeAnchors', () => {
  console.log('removeAnchors')
})

// 需要调用一次 start 以启动
session.start(errno => {
  if (errno) {
    // 如果失败，将返回 errno
  } else {
    // 否则，返回null，表示成功
  }
})
```

## 应用场景示例

1. 文本检测。
2. 车牌识别。
3. 证件文本识别。

## 程序示例

1. [实时摄像头OCR检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/ocr-detect)
2. [静态图像OCR检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-ocr-detect)
