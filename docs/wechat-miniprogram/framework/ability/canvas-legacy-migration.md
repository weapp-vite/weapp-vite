<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/canvas-legacy-migration.html -->

# 旧版 Canvas 迁移指南

小程序的 [旧版 canvas 接口](./canvas-legacy.md) 已经不再维护，本指南将指引如何迁移至新版 [Canvas 2D 接口](./canvas.md) 。

## 特性差异

<table><thead><tr><th></th> <th>旧版 canvas 接口</th> <th>Canvas 2D 接口</th></tr></thead> <tbody><tr><td>同层渲染</td> <td>不支持</td> <td>支持</td></tr> <tr><td>api支持</td> <td>部分支持</td> <td>支持全部 Web 标准</td></tr> <tr><td>绘制</td> <td>异步绘制</td> <td>同步绘制</td></tr> <tr><td>性能</td> <td>低</td> <td>高</td></tr></tbody></table>

## 迁移步骤

### 第一步：修改 WXML

```html
<canvas canvas-id="myCanvas" />
<!-- 修改为以下 -->
<canvas id="myCanvas" type="2d" />
```

旧版 canvas 接口使用 `canvas-id` 属性唯一标识 canvas；新版 Canvas 2D 可直接使用 `id` 标识。

另外需要给 canvas 添加 `type="2d"` 属性标识为新版 Canvas 2D 接口。

### 第二步：修改获取 CanvasContext

```js
const context = wx.createCanvasContext('myCanvas')
//
// 修改为以下
//
this.createSelectorQuery()
    .select('#myCanvas') // 在 WXML 中填入的 id
    .node(({ node: canvas }) => {
        const context = canvas.getContext('2d')
    })
    .exec()
```

旧版 canvas 接口使用 [wx.createCanvasContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.createCanvasContext.html) **同步** 获取 [CanvasContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html) 。

新版 Canvas 2D 接口需要先通过 [SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) **异步** 获取 [Canvas 对象](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html) ，再通过 [Canvas.getContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.getContext.html) 获取渲染上下文 [RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 。

### 第三步：画布大小初始化

```js
// 旧版 canvas 不能修改宽高
this.createSelectorQuery()
    .select('#myCanvas') // 在 WXML 中填入的 id
    .fields({ node: true, size: true })
    .exec((res) => {
        // Canvas 对象
        const canvas = res[0].node
        // Canvas 画布的实际绘制宽高
        const renderWidth = res[0].width
        const renderHeight = res[0].height
        // Canvas 绘制上下文
        const ctx = canvas.getContext('2d')

        // 初始化画布大小
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = renderWidth * dpr
        canvas.height = renderHeight * dpr
        ctx.scale(dpr, dpr)
    })
```

旧版 canvas 接口的画布大小是根据实际渲染宽度决定的，开发者无法修改。

新版 Canvas 2D 接口允许开发者自由修改画布的逻辑大小，默认宽高为 300\*150。

不同的设备上，存在物理像素和逻辑像素不相等的情况，所以一般我们需要用 [wx.getWindowInfo](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html) 获取设备的像素比，乘上 canvas 的实际大小。

### 第四步：修改绘制方法

```js
// 若干绘制调用
context.fillRect(0, 0, 50, 50)
context.fillRect(20, 20, 50, 50)

context.draw(false, () => {
    // 这里绘制完成
    console.log('draw done')
})

//
// 修改为以下
//

// 绘制前清空画布
context.clearRect(0, 0, canvas.width, canvas.height)
// 若干绘制调用
context.fillRect(0, 0, 50, 50)
context.fillRect(20, 20, 50, 50)

// 这里绘制完成
console.log('draw done')
```

旧版 canvas 接口绘制需要调用 [CanvasContext.draw](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.draw.html) 才会进行绘制，并且绘制过程是 **异步** 的，需要等待绘制完成回调才能进行下一步操作。

新版 Canvas 2D 接口不再需要调用 `draw` 函数，所有绘制方法都会 **同步** 绘制到画布上。

需要注意的是 [CanvasContext.draw](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.draw.html) 函数第一个参数控制在绘制前是否保留上一次绘制（默认值为 false，即不保留），若设置为 false，则迁移至新接口后，需要在绘制前通过 `clearRect` 清空画布。

### 第五步：修改图片绘制

```js
context.drawImage(
    'https://open.weixin.qq.com/zh_CN/htmledition/res/assets/res-design-download/icon64_wx_logo.png',
    0,
    0,
    150,
    100,
)
//
// 修改为以下
//
const image = canvas.createImage()
image.onload = () => {
    context.drawImage(
        image,
        0,
        0,
        150,
        100,
    )
}
image.src = 'https://open.weixin.qq.com/zh_CN/htmledition/res/assets/res-design-download/icon64_wx_logo.png'
```

旧版 canvas 接口 [CanvasContext.drawImage](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html) 直接传入图片 url 进行绘制。

新版 Canvas 2D 接口需要先通过 [Canvas.createImage](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.createImage.html) 创建图片对象， `onload` 图片加载完成回调触发后，再将图片对象传入 `context.drawImage` 进行绘制。

## 其余接口调整

### [wx.canvasToTempFilePath](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasToTempFilePath.html)

```js
wx.canvasToTempFilePath({
    canvasId: 'myCanvas',
    success(res) {
        //
    }
})
//
// 修改为以下
//
wx.canvasToTempFilePath({
    canvas: canvas,
    success(res) {
        //
    }
})
```

旧版 canvas 接口传入 `canvas-id` 。

新版 Canvas 2D 接口需要直接传入 [Canvas 实例](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html)

### [wx.canvasPutImageData](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasPutImageData.html)

```js
wx.canvasPutImageData({
    canvasId: 'myCanvas',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    data: data,
    success (res) {
        // after put image data
    }
})
//
// 修改为以下
//
const context = canvas.getContext('2d')
context.putImageData(data, 0, 0, 0, 0, 1, 1)
// after put image data
```

新版 canvas 不支持 [wx.canvasPutImageData](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasPutImageData.html) ，应使用 `context.putImageData` 代替。

### [wx.canvasGetImageData](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasGetImageData.html)

```js
wx.canvasGetImageData({
    canvasId: 'myCanvas',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    success(res) {
        console.log(res.width) // 100
        console.log(res.height) // 100
        console.log(res.data instanceof Uint8ClampedArray) // true
        console.log(res.data.length) // 100 * 100 * 4
    }
})
//
// 修改为以下
//
const context = canvas.getContext('2d')
const imageData = context.getImageData(0, 0, 100, 100)
console.log(imageData.width) // 100
console.log(imageData.height) // 100
console.log(imageData.data instanceof Uint8ClampedArray) // true
console.log(imageData.data.length) // 100 * 100 * 4
```

新版 canvas 不支持 [wx.canvasGetImageData](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasGetImageData.html) ，应使用 `context.getImageData` 代替。

### [wx.loadFontFace](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)

```js
wx.loadFontFace({
  family: 'Bitstream Vera Serif Bold',
  source: 'url("https://sungd.github.io/Pacifico.ttf")',
  success: console.log
})
//
// 修改为以下
//
wx.loadFontFace({
  family: 'Bitstream Vera Serif Bold',
  source: 'url("https://sungd.github.io/Pacifico.ttf")',
  scopes: ['webview', 'native'],
  success: console.log
})
```

新版 Canvas 2D 接口需要为 `scopes` 设置 `native` 。
