<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html -->

# Body检测

VisionKit从基础库 2.28.0版本开始提供body检测能力。从 微信>=8.1.0 版本开始提供人体3D关键点检测，作为Body检测的扩展能力接口。

## 方法定义

body检测有2种使用方法，一种是输入一张静态图片进行检测，另一种是通过摄像头实时检测。

### 1. 静态图片检测

通过 [VKSession.detectBody 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.detectBody.html) 输入一张图像，算法检测到图像中的人体，然后通过 [VKSession.on 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.on.html) 输出获取的人体关键点信息。

示例代码：

```js
const session = wx.createVKSession({
  track: {
    body: { mode: 2 } // mode: 1 - 使用摄像头；2 - 手动传入图像
  },
})

// 静态图片检测模式下，每调一次 detectBody 接口就会触发一次 updateAnchors 事件
session.on('updateAnchors', anchors => {
    this.setData({
        anchor2DList: anchors.map(anchor => {
            points: anchor.points, // 关键点坐标
            origin: anchor.origin, // 识别框起始点坐标
            size: anchor.size // 识别框的大小
        }),
    })
})

// 需要调用一次 start 以启动
session.start(errno => {
  if (errno) {
    // 如果失败，将返回 errno
  } else {
    // 否则，返回null，表示成功
    session.detectBody({
      frameBuffer, // 图片 ArrayBuffer 数据。待检测图像的像素点数据，每四项表示一个像素点的 RGBA
      width, // 图像宽度
      height, // 图像高度
      scoreThreshold: 0.5, // 评分阈值
      sourceType: 1 //图片来源， 默认为1， 0表示输入图片来自于视频的连续帧
    })
  }
})
```

### 2. 通过摄像头实时检测

算法实时检测相机中的人体姿态，通过 [VKSession.on 接口](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.on.html) 实时输出检测到的人体关键点。

示例代码：

```js
const session = wx.createVKSession({
  track: {
    body: { mode: 1 } // mode: 1 - 使用摄像头；2 - 手动传入图像
  },
})

// 摄像头实时检测模式下，监测到人体时，updateAnchors 事件会连续触发 （每帧触发一次）
session.on('updateAnchors', anchors => {
    this.data.anchor2DList = []
    this.data.anchor2DList = this.data.anchor2DList.concat(anchors.map(anchor => {
        points: anchor.points,
        origin: anchor.origin,
        size: anchor.size
    }))
})

// 当人体从相机中离开时，会触发 removeAnchors 事件
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

### 3. 开启3D关键点检测

想要开启人体3D关键点检测能力，静态图片模式仅需要在2D调用基础上增加 `open3d` 字段，如下

```js
// 静态图片模式调用
session.detectBody({
      ...,           // 同2D调用参数
      open3d: true,  // 开启人体3D关键点检测能力，默认为false
    })
```

摄像头实时模式则在2D调用基础上增加3D开关更新函数，如下

```js
// 摄像头实时模式调用
session.on('updateAnchors', anchors => {
  this.session.update3DMode({open3d: true})  // 开启人体3D关键点检测能力，默认为false
  ...,  // 同2D调用参数
})
```

## 输出说明

### 点位说明

人体2D关键点为23点定义，如下图所示。

![](../../_assets/body-067c84e2-adfd09a1cfce.png)

人体3D关键点为SMPL-24点关节定义，如下图所示。

![](../../_assets/smpl-4bf47c4f-8c7348f07e9e.png)

### 人体检测

人体检测输出字段包括

```js
struct anchor
{
  points,    // 人体2D关键点在图像中的(x,y)坐标
  origin,    // 人体检测框的左上角(x,y)坐标
  size,      // 人体检测框的宽和高(w,h)
  score,     // 人体检测框的置信度
  confidence // 人体关键点的置信度
}
```

### 人体3D关键点

开启人体3D关键点检测能力后，可以获取人体2D及3D关键点信息，其中人体3D关键点输出字段包括

```js
struct anchor
{
  ...,               // 人体检测2D输出信息
  points3d,          // 人体3D关键点的(x,y,z)3D坐标
  camExtArray,       // 相机外参矩阵，定义为[R, T \\ 0^3 , 1], 使用相机内外参矩阵可将3D点位投影回图像
  camIntArray        // 相机内参矩阵，参考glm::perspective(fov, width / height, near, far);
}
```

## 应用场景示例

1. 人像抠图。
2. 越界检测。
3. 人群流量统计。

## 程序示例

1. [实时摄像头body检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/body-detect)
2. [静态图像body检测能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-body-detect)
