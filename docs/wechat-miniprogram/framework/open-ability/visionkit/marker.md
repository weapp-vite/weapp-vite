<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/marker.html -->

# 2D/3D物体AR能力 （2D/3D Marker AR）

## 方法定义

2D/3D Marker AR能力，能够识别预先设定的目标物体(定义为Marker，包括2D平面物体和3D物体），进行视觉跟踪与定位，通过在目标物体周围渲染虚拟物体，从而实现AR功能。

## 方法区别

1. `2D Marker` ，仅适用于平面类物体，用户上传一张平面物体的俯视图像作为目标物体，算法运行时识别该平面物品，并渲染出相关虚拟物体。2D Marker可以理解为特殊的3D Marker。
2. `3D Marker` ，相比于2D Marker，能够识别3D物体，不局限与平面物体，具有更广的使用范围，算法运行前，需要手动制作3D Marker的识别目标文件（.map文件），然后算法运行时载入该文件用于识别。

## 使用提示

1. 使用 addMarker 接口之前，需要在 `createVKSession 的时候声明开启 marker 跟踪` 。即 wx.createVKSession({ track: { marker: true } })
2. 可以添加 `多个 Marker 图片` ，但不能重复添加相同的 marker 图片。
3. 在 v2 模式下，使用 平面识别 与 Marker检测 结合，允许 `同时识别多个 Marker` ，同时可输出多个2d/3d marker 识别结果（需要基础库版本3.0.0)，目标在视野中消失后之前返回的pose位姿信息依然有效可用，具体可以参考 [平面AR能力扩展](./plane-options.md) 以及内部的相关例子。

## 识别物体规范

为提高Marker质量，保证算法识别效果，具体请仔细阅读Marker规范文档 [Marker规范](https://developers.weixin.qq.com/miniprogram/dev/api/ai/visionkit/VKSession.addMarker.html)

## 3D Marker 识别目标文件 map 生成

目前仅允许通过 小程序示例 的 `接口` - `VisionKit视觉能力` - `3DMarkerAR` 页面生成。

#### 生成任务状态解析

1. 准备中 - 已上传，但生成服务器还未返回结果。建议等待20min，再考虑上传下一个视频（未更新结果，可以手动删除本任务，不过最好等待一天左右）
2. 生成失败 - 会在错误提示上标明错误原因
3. 已完成 - 生成完成，默认产物仅保留 30 天，请自行下载。

#### 服务耗时：

1. 当前版本 30s 视频耗时约 20分钟，请静待算法返回模型。
2. 本服务同一时间仅处理一项任务，多个任务同时进行可能会导致后续任务的失败，建议闲时错峰进行生成。

#### 对传入的视频有如下要求：

1. 视频长宽比为 16:9 或 4:3，短边大于 480px
2. 目标物体易于和背景物体区分出来，同时目标物体放置与背景物体一定距离，放置底面与物体易于区分，底面可以放置一张白纸。
3. 目标物体最好为刚体，本身不会发生较大形变，容易变形的物体不适合用作识别对象
4. 视频匀速移动，避免模糊，对目标识别面环绕物体拍摄，需要保证相机有足够的平移移动
5. marker物体要求 与 2d图像要求类似，具有丰富细节，避免重复单一纹理，不反光，无高光
6. 拍摄视频中特征纹理丰富，如果 marker 本身问题较弱，可以在背景中适当添加纹理物体
7. 不建议使用透明物体，生成效果较差。

#### 对传入的视频建议：

1. 视频格式：视频帧率30fps，分辨率建议1080p
2. 视频时长：视频建议时长在20s~30s，超过30s会被截断，时长过短会导致 marker 效果欠佳

#### 3D Marker 来源视频参考

![demo-marker3d](../../_assets/marker3d-example-8ae1db23-c486ebdbfb07.gif)

## 程序示例

以下接口可在 小程序接口能力展示demo 中的 **接口 - VisionKit视觉能力** 中体验

### 2D Marker 能力

1. [基础 2D Marker 能力示例](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/2dmarker-ar) 基础 2D Marker 识别示例。
2. [水平面 + 2D Marker 能力示例](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/plane-ar-v2-marker) 水平面AR 结合 2D Marker 识别示例。
3. [水平面 + 附加能力 示例](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/plane-ar-v2-options) 水平面AR 结合 多种附加能力示例。

### 3D Marker 能力

1. [3D Marker能力使用示例](https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageAPI/pages/ar/3dmarker-ar) 3D Marker 的生成、调用与测试示例。

#### 3D Marker案例 默认识别 大致效果

![demo-marker3d](../../_assets/marker3d-example-lmc-95e2d66b-ed7a021381b1.gif)

#### 3D Marker案例 默认识别 来源视频参考

![demo-marker3d](../../_assets/marker3d-example-lmcs-2289c6d1-335f13990726.gif)

#### 3D Marker案例 默认识别 图片

![demo-marker3d](../../_assets/demo-marker3d-d8f2207b-744c2187bfb1.png)

## 应用场景示例

2D示例：

1. 工卡AR
2. 门票AR
3. 艺术画AR

![marker2d](../../_assets/marker2d-89187544-acf696f4f72a.gif)

3D物体示例:

1. 饮料、化妆瓶等容器类AR
2. 公仔AR

![饮料、化妆瓶等容器类AR](../../_assets/marker3d-example-cola-7c4d903d-131bbe32cf19.gif)

![公仔AR](../../_assets/marker3d-4bca8f40-eb30cdf83f3a.gif)
