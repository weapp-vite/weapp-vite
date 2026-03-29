<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/canvas.html -->

# Canvas 画布

[canvas 组件](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 提供了绘制界面，可以在之上进行任意绘制

## 基础使用

### 第一步：在 WXML 中添加 canvas 组件

```html
<!-- 2d 类型的 canvas -->
<canvas id="myCanvas" type="2d" style="border: 1px solid; width: 300px; height: 150px;" />
```

首先需要在 WXML 中添加 [canvas 组件](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html) 。

指定 `id="myCanvas"` 唯一标识一个 canvas，用于后续获取 [Canvas 对象](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html) 。

指定 `type` 用于定义画布类型，本例子使用 `type="2d"` 示例。

### 第二步：获取 Canvas 对象和渲染上下文

```js
this.createSelectorQuery()
    .select('#myCanvas') // 在 WXML 中填入的 id
    .fields({ node: true, size: true })
    .exec((res) => {
        // Canvas 对象
        const canvas = res[0].node
        // 渲染上下文
        const ctx = canvas.getContext('2d')
    })
```

通过 [SelectorQuery](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.html) 选择上一步的 canvas，可以获取到 [Canvas 对象](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.html) 。

再通过 [Canvas.getContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.getContext.html) ，我们可以获取到 [渲染上下文 RenderingContext](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 。

后续的画布操作与渲染操作，都需要通过这两个对象来实现。

### 第三步：初始化 Canvas

```js
this.createSelectorQuery()
    .select('#myCanvas') // 在 WXML 中填入的 id
    .fields({ node: true, size: true })
    .exec((res) => {
        // Canvas 对象
        const canvas = res[0].node
        // 渲染上下文
        const ctx = canvas.getContext('2d')

        // Canvas 画布的实际绘制宽高
        const width = res[0].width
        const height = res[0].height

        // 初始化画布大小
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
    })
```

canvas 的宽高分为渲染宽高和逻辑宽高：

- 渲染宽高为 canvas 画布在页面中所实际占用的宽高大小，即通过对节点进行 [boundingClientRect](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.boundingClientRect.html) 请求获取到的大小。
- 逻辑宽高为 canvas 在渲染过程中的逻辑宽高大小，如绘制一个长方形与逻辑宽高相同，最终长方形会占满整个画布。逻辑宽高默认为 `300 * 150` 。

不同的设备上，存在物理像素和逻辑像素不相等的情况，所以一般我们需要用 [wx.getWindowInfo](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html) 获取设备的像素比，乘上 canvas 的渲染大小，作为画布的逻辑大小。

### 第四步：进行绘制

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/smH8LGmn7Lz5)

```js
// 省略上面初始化步骤，已经获取到 canvas 对象和 ctx 渲染上下文

// 清空画布
ctx.clearRect(0, 0, width, height)

// 绘制红色正方形
ctx.fillStyle = 'rgb(200, 0, 0)';
ctx.fillRect(10, 10, 50, 50);

// 绘制蓝色半透明正方形
ctx.fillStyle = 'rgba(0, 0, 200, 0.5)';
ctx.fillRect(30, 30, 50, 50);
```

通过 [渲染上下文](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/RenderingContext.html) 上的绘图 api，我们可以在画布上进行任意的绘制。

## 进阶使用

### 绘制图片

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/2FHoZGmA7XzI)

```js
// 省略上面初始化步骤，已经获取到 canvas 对象和 ctx 渲染上下文

// 图片对象
const image = canvas.createImage()
// 图片加载完成回调
image.onload = () => {
    // 将图片绘制到 canvas 上
    ctx.drawImage(image, 0, 0)
}
// 设置图片src
image.src = 'https://open.weixin.qq.com/zh_CN/htmledition/res/assets/res-design-download/icon64_wx_logo.png'
```

通过 [Canvas.createImage](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.createImage.html) 我们可以创建图片对象并加载图片。当图片加载完成触发 `onload` 回调之后，使用 `ctx.drawImage` 即可将图片绘制到 canvas 上。

### 生成图片

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/FPIGmGmT7fzB)

```js
// 省略上面初始化步骤，已经获取到 canvas 对象和 ctx 渲染上下文

// 绘制红色正方形
ctx.fillStyle = 'rgb(200, 0, 0)';
ctx.fillRect(10, 10, 50, 50);

// 绘制蓝色半透明正方形
ctx.fillStyle = 'rgba(0, 0, 200, 0.5)';
ctx.fillRect(30, 30, 50, 50);

// 生成图片
wx.canvasToTempFilePath({
    canvas,
    success: res => {
        // 生成的图片临时文件路径
        const tempFilePath = res.tempFilePath
    },
})
```

通过 [wx.canvasToTempFilePath](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasToTempFilePath.html) 接口，可以将 canvas 上的内容生成图片临时文件。

### 帧动画

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/fmIKNGmF7tzV)

```js
// 省略上面初始化步骤，已经获取到 canvas 对象和 ctx 渲染上下文

const startTime = Date.now()

// 帧渲染回调
const draw = () => {
  const time = Date.now()
  // 计算经过的时间
  const elapsed = time - startTime

  // 计算动画位置
  const n = Math.floor(elapsed / 3000)
  const m = elapsed % 3000
  const dx = (n % 2 ? 0 : 1) + (n % 2 ? 1 : -1) * (m < 2500 ? easeOutBounce(m / 2500) : 1)
  const x = (width - 50) * dx

  // 渲染
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgb(200, 0, 0)';
  ctx.fillRect(x, height / 2 - 25, 50, 50);

  // 注册下一帧渲染
  canvas.requestAnimationFrame(draw)
}

draw()
```

通过 [Canvas.requestAnimationFrame](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/Canvas.requestAnimationFrame.html) 可以注册动画帧回调，在回调内进行动画的逐帧绘制。

### 自定义字体

通过 [wx.loadFontFace](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html) 可以为 Canvas 加载自定义字体。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/GAIwtGmB7Ez3)

### 录制视频

通过 [MediaRecorder](https://developers.weixin.qq.com/miniprogram/dev/api/media/media-recorder/MediaRecorder.html) 可以将 Canvas 内容录制为视频并保存。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/MCz3kPmC7zpa)

### WebGL

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/9gIuqGmN7QzX)

```html
<canvas type="webgl" id="myCanvas" />
```

```js
// 省略上面初始化步骤，已经获取到 canvas 对象

const gl = canvas.getContext('webgl') // 获取 webgl 渲染上下文
```
