<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/idcard.html -->

# 身份证检测

VisionKit 从基础库 `3.3.0` 版本 后开始支持。

`身份证检测` 能力作为与 `其他 VisionKit 能力` 平行的能力接口。

该能力，一般用于用户进行 `身份证识别` 或者 `身份证裁剪` 等功能的开发。

## 方法定义

身份证检测，目前只支持通过 `视觉模式` ，即输入一张静态图片进行身份证识别，返回身份证对应信息。

可以通过配置 `getAffineImg` ，决定每次识别是否返回 `身份证区域裁剪矩阵` 。

### 输入身份证图片要求

输入的身份证图片，尽量以 `正常的角度拍摄` 。不同角度带来的 `透视效果` ，会影响识别的 `准确度` 。

### 视觉模式接口

首先需要创建 [VKSession](./base.md) 的配置，然后通过 `VKSession.start` 启动 VKSession 实例。

开启VKSession，并添加返回对应身份证信息监听事件，示例代码：

```js
// VKSession 配置
const session = wx.createVKSession({
    track: {
        IDCard: {
            mode: 2 // 照片模式
        }
    },
    version: 'v1',
})

// VKSession start
session.start(err => {

  // 静态图片估计模式下，每调一次 detectIDCard 接口就会触发一次 updateAnchors 事件
  session.on('updateAnchors', anchors => {
      // 处理返回的身份证信息
      if (anchors && anchors[0]) {
          // 存在数组，证明存在身份证信息
          const anchor = anchors[0];

          // 识别信息
          const isComplete = anchor.isComplete; // 身份证是否完整
          const label = anchor.label; // 身份证面信息（0 照片面 / 1 国徽面 ）
          const orientation = anchor.orientation; // 身份证朝向 （0 朝上 1 朝下 2 朝下 3 朝左）
          const box = anchor.box; // 身份证坐标框点数组 （0 左上点 1 右上点 2 右下点 3 左下点）

          // 裁剪信息，接口 getAffineImg 为 true 时会返回。
          const affineImgWidth = anchor.affineImgWidth;
          const affineImgHeight = anchor.affineImgHeight;
          const affineMat = anchor.affineMat;

          // 存在裁剪信息，可以结合原图获取裁剪后的身份证图片
          if (affineImgWidth && affineImgHeight && affineMat) {
            /*
              * affineMat 3x3仿射变换矩阵，行主序
              *  [0 1 2
              *   3 4 5
              *   6 7 8]
              */
            /*
              * canvas 2d setTransform
              * setTransform(a, b, c, d, e, f)
              *  [a c e
              *   b d f
              *   0 0 1]
              */
             // 可以利用离屏的Canvas2D，结合原图与裁剪矩阵，进行具体的身份证图片裁剪。
          }
      }

  })
  // 图片没有识别到身份证，会触发一次 removeAnchors
  session.on('removeAnchors', anchors => {
      console.log("没有识别到身份证")
  })
});
```

调用身份证识别，示例代码：

```js

// 调用具体的身份证图片识别接口
session.detectIDCard({
    // 识别身份证图片的 ArrayBuffer，Uint8ClampedArray，RGBA
    // 比如可以通过 canvas（2D）的 context.getImageData 获取
    frameBuffer: imgDataBuffer,
    // 传入识别图片的原始宽度
    width: imgOriginWidth,
    // 传入识别图片的原始高度
    height: imgOriginHeight,
    // 是否获取裁剪图片信息
    getAffineImg: true,
})
// 调用后，识别处理完毕后
// 识别成功会触发 updateAnchors 回调，处理失败会触发 removeAnchors 回调
```

## 输出说明

anchor 信息

```js
struct anchor
{
  isComplete,  // 身份证是否完整
  label,       // 身份证面信息（0 照片面 / 1 国徽面 ）
  orientation, // 身份证朝向 （0 朝上 1 朝下 2 朝下 3 朝左）
  box,         // 身份证坐标框点数组 （0 左上点 1 右上点 2 右下点 3 左下点）
  /* 身份证裁剪信息
   * getAffineImg 为 true 时返回 */
  affineImgWidth,   // 身份证裁剪宽度
  affineImgHeight,  // 身份证裁剪区域高度
  affineMat,        // 身份证裁剪矩阵
}
```

### 身份证坐标框点数组 box

长度为 4 的数组，表示 身份证位于原图中，框的坐标点位置。

```js
Array<Point>(8) box
```

每个数组元素结构为:

```js
struct Point { x, y }
```

### 身份证裁剪矩阵 affineMat

长度为 9 的数组，表示行主序 的 3x3仿射变换矩阵。可以结合 Canvas (2D) 以及原图进行具体的身份证图片裁剪。

## 程序示例

#### 身份证照片识别示例

小程序示例 的 `接口` - `VisionKit视觉能力` - `照片身份证识别`

开源地址： [照片身份证识别](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/photo-idcard-detect)
