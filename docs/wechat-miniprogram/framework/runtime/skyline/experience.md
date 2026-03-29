<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/experience.html -->

# 快速体验

## 环境要求

目前， [安卓微信 8.0.33](https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_faq_list&head=true) 、 [iOS 微信 8.0.34](https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_faq_list&head=true) 起内置了 Skyline 渲染引擎，可先更新到该版本，预览时通过 [强切开关](./migration/README.md#%E5%BF%AB%E6%8D%B7%E5%88%87%E6%8D%A2%E5%85%A5%E5%8F%A3) 打开，方可体验 Skyline。

## 快速体验

以下小程序已适配 Skyline，可直接扫码打开体验。

扫码打开小程序助手，其中首页、切换小程序、版本查看、成员管理和成员申请均已适配。

![](../../_assets/asistant-81723097-1edc8eadc6d2.jpeg)

扫码小程序示例，可进入 `交互动画` tab 页体验 Skyline 的新特性。

![](../../_assets/skyline-demo-37eff20b-636b8199f9d5.png)

## 演示案例

以下是用 Skyline 实现的各种常见交互动画的示例，可通过视频直接预览效果，也可直接扫码在移动端上体验。

通讯录

使用 scroll-view 自定义模式，配合 sticky 吸顶布局容器，实现通讯录字母交错吸顶的效果。

点击查看源代码

![](../../_assets/2UvOyz49SWYTYSsGtyUhT50NvZEgzSkM0CimenQPqYg4Mxyg-4QcNTeplvZmgrUnk5mAunTu11R0T4RT9Ibc4g-1101780f1eed.png)

半屏

基于 worklet 动画，通过手势协商机制，实现在半屏内列表往下拉到顶之后，无缝切换到半屏下拉的效果。

点击查看源代码

![](../../_assets/_1ypdusk8RgBrMIG3XWGMRbmcl9K2LWsnh6h4UYNCkt20VejkS5x-imt0qVaO9vzWiQcX_y0xgVGVuGkL6rrw-5bd0d3393711.png)

分段半屏

通过 worklet 动画、手势协商，实现分段半屏，处于不同位置时联动半屏后的地图改变缩放比例。

点击查看源代码

![](../../_assets/ogLHam6S-DXaB_5ailfHumSp2wA4tKAKrr_K6uJXxQsNnE7JgPEwl93nl_xfZJdn5Paw6CGDbRO1orefkyIqGA-3225b389f1bc.jpg)

相册

使用自定义路由、共享元素动画、手势系统等实现列表中图片共享放大过渡到图片预览页效果，并实现预览图片的手势交互。

点击查看源代码

![](../../_assets/_1ypdusk8RgBrMIG3XWGLho7g6vx6ZuMGscwSavgGyx06i3GF-NHCd2CjGPvDkhusm7GGXgoj9ZEtOYkH153w-ab509a993bc3.png)

Tab 指示条

利用 swiper 切换时的逐帧回调，配合 worklet 动画实现 tab 指示条顺滑切换的效果。

点击查看源代码

![](../../_assets/2UvOyz49SWYTYSsGtyUhT1zogL3487fH9Sx6gDsh5DPYDIhqAANuXtqSZlnpY5M6saexU8WPM3Y1dGnUj1pQDw-1d1da0b867df.png)

卡片转场

scroll-view 瀑布流模式配合共享元素动画实现卡片柔性转场效果。

点击查看源代码

![](../../_assets/1TdiJdN3xciFb1tvKi0sWa13nJWhqC8km1dF4cvYRTTEZShk_HXoWMeNJVOBTgkbInZvlaeLz2Oagby3UgAEXg-674de764cf66.png)

搜索栏吸附

scroll-view 吸顶布局结合 worklet 布局轻松实现搜索栏吸附效果。

点击查看源代码

![](../../_assets/eki_c6cJ1PZ0aWNRUv3qb4p0ZW0H98Qz0p80Fc4PMIcc5aRMV4siSHhu5rjjMXGkK9Q6oAuzuMMSCTD0aQYLQQ-77d0a963d397.png)

沉浸式商品浏览

小程序手势 + worklet 在页面中实现广告、商品无缝切换。

点击查看源代码

![](../../_assets/84Ugx4XBVDOI9pnExLJH9HI6Z2VM7KvuelM4Wa9tHYOuFNZ24P4R7FdqpxGQ8TTnvAiT3dS6CUFG-vCzzhEtTA-677058e9556b.png)
