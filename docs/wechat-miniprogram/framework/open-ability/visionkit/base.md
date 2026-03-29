<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/base.html -->

## VisionKit

小程序也在基础库 2.20.0 版本开始提供了开发 AR 功能的能力，即 VisionKit。VisionKit 包含了 AR 在内的视觉算法，要想开发小程序的 AR 功能，我们需要先了解 VisionKit。

## VKSession

VisionKit 的核心就是 VKSession，即 VisionKit 会话对象。我们可以通过 `wx.createVKSession` 来创建 VKSession 的实例，此实例在页面上是单例，和页面的生命周期强相关，且页面间的 VKSeesion 实例运行周期互斥，这就确保了一个小程序在一个确定的时刻最多只会有一个 VKSession 实例，下面的 demo 以 v2 版本为例。

```js
const session = wx.createVKSession({
  track: {
    plane: {mode: 3},
  },
  version: 'v2',
})
```

调 VKSession 实例的 `start` 方法可以启动 VKSession 实例：

```js
session.start(err => {
  if (err) return console.error('VK error: ', err)

  // do something
})
```

接下来，我们要构建 3D 世界和渲染了。

## 渲染

AR 本意即为增强现实，通俗来讲就是可以在现实世界融入虚拟的东西，比如在现实世界的桌面上放一个虚拟的机器人。

那么要在小程序中看到这个效果，我们首先要能将现实画面画到屏幕上，这就依赖我们的摄像头了。当然，画面不是静止不动的，所以我们还得连续的将摄像头拍到的画面上屏，这就和我们使用 WebGL 绘制 3D 世界类似，逐帧渲染：

```js
session.start(err => {
  if (err) return console.error('VK error: ', err)

  const onFrame = timestamp => {
    const frame = session.getVKFrame(canvas.width, canvas.height)
    if (frame) {
      renderFrame(frame)
    }

    session.requestAnimationFrame(onFrame)
  }
  session.requestAnimationFrame(onFrame)
})
```

在大家熟知的 `requestAnimationFrame` 内，通过 VKSession 实例的 `getVKFrame` 方法可以获取到帧对象，帧对象中即包含了我们需要上屏的画面。此处我们在调 `getVKFrame` 时传入了画布的宽高，是因为我们此处就准备将其用 WebGL 渲染出来，之后我们就来看看 `renderFrame` 里是如何做的：

```js
function renderFrame(frame) {
  renderGL(frame)

  // do something
}

function renderGL(frame) {
  const { yTexture, uvTexture } = frame.getCameraTexture(gl, 'yuv')
  const displayTransform = frame.getDisplayTransform()

  // 上屏
}
```

通过 `getCameraTexture` 我们可以拿到 yuv 纹理，而此纹理是未经裁剪调整的纹理，所以还需要通过 `getDisplayTransform` 获取到纹理调整矩阵，然后在上屏时可以使用此矩阵对纹理进行裁剪调整。此处代码中的 gl 即是 WebGLRenderingContext 实例。

## WebGL & three.js

那么上屏需要如何操作呢？这里需要我们拥有一定的 WebGL 知识，在此 demo 中我们自己编写着色器来将画面渲染到画布上，用 three.js 来渲染 3D 模型。

首先是初始化 three.js 部分：

```js
import { createScopedThreejs } from 'threejs-miniprogram'
import { registerGLTFLoader } from './loaders/gltf-loader'

const THREE = createScopedThreejs(canvas)
registerGLTFLoader(THREE)

// 相机
const camera = new THREE.Camera()

// 场景
const scene = new THREE.Scene()

// 光源
const light1 = new THREE.HemisphereLight(0xffffff, 0x444444) // 半球光
light1.position.set(0, 0.2, 0)
scene.add(light1)
const light2 = new THREE.DirectionalLight(0xffffff) // 平行光
light2.position.set(0, 0.2, 0.1)
scene.add(light2)

// 渲染层
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
renderer.gammaOutput = true
renderer.gammaFactor = 2.2

// 机器人模型
const loader = new THREE.GLTFLoader()
let model
loader.load('https://dldir1.qq.com/weixin/miniprogram/RobotExpressive_aa2603d917384b68bb4a086f32dabe83.glb', gltf => {
  model = {
    scene: gltf.scene,
    animations: gltf.animations,
  }
})
const clock = new THREE.Clock()
```

此处使用 `threejs-miniprogram` 包，这是经过特殊封装以兼容小程序环境的 three.js 包，当然开发者们也可以替换成任意其它可以在小程序中跑的 WebGL 引擎，此处仅仅是以 three.js 来举例。registerGLTFLoader 则是用来加载 3D 模型。关于 three.js 的使用，这里只是给出了一个简单的 demo，有兴趣者可以查阅官方文档进行了解。

接下来是初始化 WebGL：

```js
const gl = renderer.getContext()

// 编写着色器
const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM)
const vs = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  uniform mat3 displayTransform;
  varying vec2 v_texCoord;
  void main() {
    vec3 p = displayTransform * vec3(a_position, 0);
    gl_Position = vec4(p, 1);
    v_texCoord = a_texCoord;
  }
`
const fs = `
  precision highp float;

  uniform sampler2D y_texture;
  uniform sampler2D uv_texture;
  varying vec2 v_texCoord;
  void main() {
    vec4 y_color = texture2D(y_texture, v_texCoord);
    vec4 uv_color = texture2D(uv_texture, v_texCoord);

    float Y, U, V;
    float R ,G, B;
    Y = y_color.r;
    U = uv_color.r - 0.5;
    V = uv_color.a - 0.5;

    R = Y + 1.402 * V;
    G = Y - 0.344 * U - 0.714 * V;
    B = Y + 1.772 * U;

    gl_FragColor = vec4(R, G, B, 1.0);
  }
`
const vertShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertShader, vs)
gl.compileShader(vertShader)

const fragShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragShader, fs)
gl.compileShader(fragShader)

const program = gl.createProgram()
gl.attachShader(program, vertShader)
gl.attachShader(program, fragShader)
gl.deleteShader(vertShader)
gl.deleteShader(fragShader)
gl.linkProgram(program)
gl.useProgram(program)

const uniformYTexture = gl.getUniformLocation(program, 'y_texture')
gl.uniform1i(uniformYTexture, 5)
const uniformUVTexture = gl.getUniformLocation(program, 'uv_texture')
gl.uniform1i(uniformUVTexture, 6)

const dt = gl.getUniformLocation(program, 'displayTransform')
gl.useProgram(currentProgram)

// 初始化 VAO
const ext = gl.getExtension('OES_vertex_array_object')
const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING)
const vao = ext.createVertexArrayOES()

ext.bindVertexArrayOES(vao)

const posAttr = gl.getAttribLocation(program, 'a_position')
const pos = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, pos)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), gl.STATIC_DRAW)
gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)
gl.enableVertexAttribArray(posAttr)
vao.posBuffer = pos

const texcoordAttr = gl.getAttribLocation(program, 'a_texCoord')
const texcoord = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, texcoord)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), gl.STATIC_DRAW)
gl.vertexAttribPointer(texcoordAttr, 2, gl.FLOAT, false, 0, 0)
gl.enableVertexAttribArray(texcoordAttr)
vao.texcoordBuffer = texcoord

ext.bindVertexArrayOES(currentVAO)
```

这一块属于 WebGL 的知识，这里就不再做过多赘述，有兴趣者可以借助搜索引擎查阅相关资料了解。之后我们就可以完善前面的 `renderGL` 方法，完成上屏代码的编写：

```js
function renderGL(frame) {
  const gl = renderer.getContext()
  gl.disable(gl.DEPTH_TEST)

  // 获取纹理和调整矩阵
  const {yTexture, uvTexture} = frame.getCameraTexture(gl, 'yuv')
  const displayTransform = frame.getDisplayTransform()

  if (yTexture && uvTexture) {
    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM)
    const currentActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE)
    const currentVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING)

    gl.useProgram(program)
    ext.bindVertexArrayOES(vao)

    // 传入调整矩阵
    gl.uniformMatrix3fv(dt, false, displayTransform)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

    // 传入 y 通道纹理
    gl.activeTexture(gl.TEXTURE0 + 5)
    const bindingTexture5 = gl.getParameter(gl.TEXTURE_BINDING_2D)
    gl.bindTexture(gl.TEXTURE_2D, yTexture)

    // 传入 uv 通道纹理
    gl.activeTexture(gl.TEXTURE0 + 6)
    const bindingTexture6 = gl.getParameter(gl.TEXTURE_BINDING_2D)
    gl.bindTexture(gl.TEXTURE_2D, uvTexture)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindTexture(gl.TEXTURE_2D, bindingTexture6)
    gl.activeTexture(gl.TEXTURE0 + 5)
    gl.bindTexture(gl.TEXTURE_2D, bindingTexture5)

    gl.useProgram(currentProgram)
    gl.activeTexture(currentActiveTexture)
    ext.bindVertexArrayOES(currentVAO)
  }
}
```

至此，基础背景画面就画到屏幕上了，在手机上看到的效果就如同开着摄像头一样。

## 放置 3D 模型

诚然，仅效果来看，到此为止还不能将其称其为 AR，接下来我们要实现这么一个功能：点击屏幕，然后在画面上对应的 3D 世界位置放置一个机器人模型；比如点击画面中的桌子，就在桌子上放一个机器人模型。

前面我们引入的 three.js 就是为了做这个效果，现在流行的 WebGL 引擎基本上都封装了大量方便我们快速使用的接口，比如光照渲染、模型加载等，前面的代码已经做过演示，这里就不再重复说明。

这里我们需要了解的是 VKSession 的 hitTest 接口。这个接口的主要是为了将 2D 坐标转成 3D 世界坐标，即 (x, y) 转成 (x, y, z)。通俗来说就是画面上显示的桌子，在屏幕上它是 2D 的，当我们手指触摸屏幕时拿到的坐标是 2D 坐标，也就是 (x, y)；hitTest 接口可以将其转换成 3D 世界坐标 (x, y, z)，而 3D 世界坐标系的原点则是相机打开瞬间其所在的点：

```js
function onTouchEnd(evt) {
  const touches = evt.changedTouches.length ? evt.changedTouches : evt.touches

  // 在点击位置放一个机器人模型
  if (touches.length === 1) {
    const touch = touches[0]
    if (session && scene && model) {
      // 调用 hitTest
      const hitTestRes = session.hitTest(touch.x / width, touch.y / height)
      if (hitTestRes.length) {
        model.scene.scale.set(0.05, 0.05, 0.05)

        // 动画混合器
        const mixer = new THREE.AnimationMixer(scene)
        for (let i = 0; i < model.animations.length; i++) {
          const clip = model.animations[i]
          if (clip.name === 'Dance') {
            const action = mixer.clipAction(clip)
            action.play()
          }
        }

        // 把模型放到对应的位置上
        const cnt = new THREE.Object3D()
        cnt.add(model.scene)
        model.matrixAutoUpdate = false
        model.matrix.fromArray(hitTestRes[0].transform)
        scene.add(model)
      }
    }
  }
}
```

可以看到 `hitTest` 传入的两个参数并不是标准的坐标值，而是将其除以画布宽高后得到的值再传入。这里接受的参数其实是相对于画布视窗的坐标，取值范围为 [0, 1]，0 为左/上边缘，1 为右/下边缘。而 `hitTest` 返回的结果则是矩阵，里面包含了 3D 世界坐标的位置、旋转和放缩信息。可以看到这矩阵可以直接为 three.js 所用，这也是此次 demo 选用 three.js 的原因之一，它封装了很多繁杂的实现细节，简化了大量代码。

之后就是调 three.js 相关的渲染接口，把机器人模型也画到画面上，这里我们可以继续完善前面的 `renderFrame` 方法：

```js
function renderFrame(frame) {
  renderGL(frame)

  const frameCamera = frame.camera

  // 更新动画
  const dt = clock.getDelta()
  mixer.update(dt)

  // 相机
  if (camera) {
    camera.matrixAutoUpdate = false
    camera.matrixWorldInverse.fromArray(frameCamera.viewMatrix)
    camera.matrixWorld.getInverse(camera.matrixWorldInverse)

    const projectionMatrix = frameCamera.getProjectionMatrix(NEAR, FAR)
    camera.projectionMatrix.fromArray(projectionMatrix)
    camera.projectionMatrixInverse.getInverse(camera.projectionMatrix)
  }

  renderer.autoClearColor = false
  renderer.render(scene, camera)
  renderer.state.setCullFace(THREE.CullFaceNone)
}
```

这里通过帧对象的 `camera` 属性拿到了帧相机，然后通过帧相机的 `viewMatrix` 拿到了视图矩阵，通过 `getProjectionMatrix` 方法拿到了投影矩阵，统统传给 three.js 的相机对象，以确保 three.js 的相机位置、角度正确，同时确保 3D 世界渲染出来的效果符合我们人眼所看到的景象。

至此，前面那个点屏幕点击位置对应的 3D 世界放置一个机器人模型的效果得以完成。

## 平面检测

在对如何在小程序中实现一个 AR 功能有所了解后，我们可能需要扩展一些场景：比如需要检测出 3D 世界的平面。

VisionKit 识别到的平面会以 anchor 对象的方式提供给我们，这里 VKSession 提供了很便利的事件：addAnchors/updateAnchors/removeAnchors，通过这三个事件我们可以监听 anchor 列表的变化：

```js
session.on('addAnchors', anchors => {
  // anchor.id - anchor 唯一标识
  // anchor.type - anchor 类型，0 表示是平面 anchor
  // anchor.transform - 包含位置、旋转、放缩信息的矩阵，以列为主序
  // anchor.size - 尺寸
  // anchor.alignment - 方向

  // do something
})
session.on('updateAnchors', anchors => {
  // do something
})
session.on('removeAnchors', anchors => {
  // do something
})
```

- 程序示例 可以在 [VisionKit基础能力使用参考](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/visionkit-basic) 页面查看示例代码。
