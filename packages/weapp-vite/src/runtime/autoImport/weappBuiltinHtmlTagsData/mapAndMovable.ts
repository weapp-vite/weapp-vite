// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MAP_AND_MOVABLE = [
  {
    "name": "map",
    "description": "地图 v2.7.0 起支持[同层渲染](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html#%E5%8E%9F%E7%94%9F%E7%BB%84%E4%BB%B6%E5%90%8C%E5%B1%82%E6%B8%B2%E6%9F%93)。\nmap组件提供了地图展示、交互、叠加点线面及文字等功能，同时支持个性化地图样式，可结合地图服务 API 实现更丰富功能。\n为了更好的提供地图服务，请在调用 `map` 组件之前，先前往腾讯位置服务官网注册一个专属 `KEY`,在地图开发过程中，可以将这个专属 `KEY` 通过 `subkey` 参数传入；后续如遇到地图开发问题也可以在腾讯位置服务官网工单系统提交工单反馈解决；",
    "attributes": [
      {
        "name": "alpha",
        "description": "Type: number\n标注的透明度"
      },
      {
        "name": "anchor",
        "description": "Type: Object\n经纬度在标注图标的锚点，默认底边中点\nSince: 1.2.0"
      },
      {
        "name": "anchorX",
        "description": "Type: number\nlabel的坐标，原点是 marker 对应的经纬度\nSince: 2.1.0"
      },
      {
        "name": "anchorY",
        "description": "Type: number\nlabel的坐标，原点是 marker 对应的经纬度\nSince: 2.1.0"
      },
      {
        "name": "aria-label",
        "description": "Type: string\n无障碍访问，（属性）元素的额外描述\nSince: 2.5.0"
      },
      {
        "name": "arrowIconPath",
        "description": "Type: string\n更换箭头图标\nSince: 1.6.0"
      },
      {
        "name": "arrowLine",
        "description": "Type: boolean\n带箭头的线\nSince: 1.2.0"
      },
      {
        "name": "bgColor",
        "description": "Type: string\n背景色\nSince: 1.6.0"
      },
      {
        "name": "bindabilityfail",
        "description": "Type: function => any\n地图能力失败时触发，`e.detail = {ability, errCode, errMsg}`"
      },
      {
        "name": "bindabilitysuccess",
        "description": "Type: function => any\n地图能力生效时触发，`e.detail = {ability, errCode, errMsg}`"
      },
      {
        "name": "bindauthsuccess",
        "description": "Type: function => any\n地图鉴权结果成功时触发，`e.detail = {errCode, errMsg}`"
      },
      {
        "name": "bindcallouttap",
        "description": "Type: function => any\n点击标记点对应的气泡时触发`e.detail = {markerId}`\nSince: 1.2.0"
      },
      {
        "name": "bindcontroltap",
        "description": "Type: function => any\n点击控件时触发，`e.detail = {controlId}`\nSince: 1.0.0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n组件错误时触发，例如创建或鉴权失败，`e.detail = {longitude, latitude}`"
      },
      {
        "name": "bindinterpolatepoint",
        "description": "Type: function => any\nMapContext.moveAlong 插值动画时触发。`e.detail = {markerId, longitude, latitude, animationStatus: \"interpolating\" | \"complete\"}`,\nSince: 3.1.0"
      },
      {
        "name": "bindlabeltap",
        "description": "Type: function => any\n点击label时触发，`e.detail = {markerId}`\nSince: 2.9.0"
      },
      {
        "name": "bindmarkertap",
        "description": "Type: function => any\n点击标记点时触发，`e.detail = {markerId}`\nSince: 1.0.0"
      },
      {
        "name": "bindpoitap",
        "description": "Type: function => any\n点击地图poi点时触发，`e.detail = {name, longitude, latitude}`\nSince: 2.3.0"
      },
      {
        "name": "bindpolylinetap",
        "description": "Type: function => any\n点击地图路线时触发，`e.detail = {longitude, latitude}`\nSince: 3.1.0"
      },
      {
        "name": "bindregionchange",
        "description": "Type: function => any\n视野发生变化时触发，\nSince: 2.3.0"
      },
      {
        "name": "bindtap",
        "description": "Type: function => any\n点击地图时触发，[2.9.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起返回经纬度信息\nSince: 1.0.0"
      },
      {
        "name": "bindupdated",
        "description": "Type: function => any\n在地图渲染更新完成时触发\nSince: 1.6.0"
      },
      {
        "name": "borderColor",
        "description": "Type: string\n线的边框颜色\nSince: 1.2.0"
      },
      {
        "name": "borderRadius",
        "description": "Type: number\n边框圆角\nSince: 1.6.0"
      },
      {
        "name": "borderWidth",
        "description": "Type: number\n线的厚度\nSince: 1.2.0"
      },
      {
        "name": "callout",
        "description": "Type: Object\n标记点上方的气泡窗口\nSince: 1.2.0"
      },
      {
        "name": "causedBy",
        "description": "Type: string\n导致视野变化的原因"
      },
      {
        "name": "circles",
        "description": "Type: any[]\n圆\nSince: 1.0.0"
      },
      {
        "name": "clickable",
        "description": "Type: boolean\n是否可点击"
      },
      {
        "name": "clusterId",
        "description": "Type: number\n聚合簇的 id"
      },
      {
        "name": "collision",
        "description": "Type: string\n碰撞类型\nSince: 3.4.3"
      },
      {
        "name": "collisionRelation",
        "description": "Type: string\n碰撞关系\nSince: 3.4.3"
      },
      {
        "name": "color",
        "description": "Type: string\n描边的颜色\nSince: 1.2.0"
      },
      {
        "name": "colorList",
        "description": "Type: any[]\n彩虹线\nSince: 2.13.0"
      },
      {
        "name": "content",
        "description": "Type: string\n文本\nSince: 1.2.0"
      },
      {
        "name": "controls",
        "description": "Type: any[]\n控件（即将废弃，建议使用 [cover-view](https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html) 代替）\nSince: 1.0.0"
      },
      {
        "name": "covers",
        "description": "Type: any[]\n即将移除，请使用 markers\nSince: 1.0.0"
      },
      {
        "name": "customCallout",
        "description": "Type: Object\n自定义气泡窗口"
      },
      {
        "name": "dashArray",
        "description": "Type: number[]\n边线虚线\nSince: 2.22.0"
      },
      {
        "name": "display",
        "description": "Type: string\n'BYCLICK':点击显示; 'ALWAYS':常显\nSince: 2.12.0"
      },
      {
        "name": "dottedLine",
        "description": "Type: boolean\n是否虚线"
      },
      {
        "name": "enable-3D",
        "description": "Type: boolean\n展示3D楼块\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-auto-max-overlooking",
        "description": "Type: boolean\n开启最大俯视角，俯视角度从 45 度拓展到 75 度\nDefault: false\nSince: 2.26.0"
      },
      {
        "name": "enable-building",
        "description": "Type: boolean\n是否展示建筑物\nSince: 2.14.0"
      },
      {
        "name": "enable-overlooking",
        "description": "Type: boolean\n开启俯视\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-poi",
        "description": "Type: boolean\n是否展示 POI 点\nDefault: true\nSince: 2.14.0"
      },
      {
        "name": "enable-rotate",
        "description": "Type: boolean\n是否支持旋转\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-satellite",
        "description": "Type: boolean\n是否开启卫星图\nDefault: false\nSince: 2.7.0"
      },
      {
        "name": "enable-scroll",
        "description": "Type: boolean\n是否支持拖动\nDefault: true\nSince: 2.3.0"
      },
      {
        "name": "enable-traffic",
        "description": "Type: boolean\n是否开启实时路况\nDefault: false\nSince: 2.7.0"
      },
      {
        "name": "enable-zoom",
        "description": "Type: boolean\n是否支持缩放\nDefault: true\nSince: 2.3.0"
      },
      {
        "name": "endIndex",
        "description": "Type: number\n终点"
      },
      {
        "name": "fillColor",
        "description": "Type: string\n填充颜色"
      },
      {
        "name": "fontSize",
        "description": "Type: number\n文本大小\nDefault: 14\nSince: 1.2.0"
      },
      {
        "name": "height",
        "description": "Type: number\n控件高度"
      },
      {
        "name": "iconPath",
        "description": "Type: string\n显示的图标"
      },
      {
        "name": "id",
        "description": "Type: number\n控件id"
      },
      {
        "name": "include-points",
        "description": "Type: any[]\n缩放视野以包含所有给定的坐标点\nSince: 1.0.0"
      },
      {
        "name": "joinCluster",
        "description": "Type: boolean\n是否参与点聚合"
      },
      {
        "name": "label",
        "description": "Type: Object\n为标记点旁边增加标签\nSince: 1.2.0"
      },
      {
        "name": "latitude",
        "description": "Type: number\n纬度\nSince: 1.0.0"
      },
      {
        "name": "layer-style",
        "description": "Type: number\n地图能力【个性化地图】配置的 style\nDefault: 1"
      },
      {
        "name": "left",
        "description": "Type: number\n距离地图的左边界多远"
      },
      {
        "name": "level",
        "description": "Type: string\n压盖关系\nSince: 2.14.0"
      },
      {
        "name": "longitude",
        "description": "Type: number\n经度\nSince: 1.0.0"
      },
      {
        "name": "markers",
        "description": "Type: any[]\n标记点\nSince: 1.0.0"
      },
      {
        "name": "max-scale",
        "description": "Type: number\n最大缩放级别\nDefault: 20\nSince: 2.13.0"
      },
      {
        "name": "min-scale",
        "description": "Type: number\n最小缩放级别\nDefault: 3\nSince: 2.13.0"
      },
      {
        "name": "name",
        "description": "Type: string\n名称\nDefault: ''"
      },
      {
        "name": "padding",
        "description": "Type: number\n文本边缘留白\nSince: 1.6.0"
      },
      {
        "name": "points",
        "description": "Type: any[]\n经纬度数组\nSince: 2.3.0"
      },
      {
        "name": "polygons",
        "description": "Type: any[]\n多边形\nSince: 2.3.0"
      },
      {
        "name": "polyline",
        "description": "Type: any[]\n路线\nSince: 1.0.0"
      },
      {
        "name": "position",
        "description": "Type: Object\n控件在地图的位置"
      },
      {
        "name": "radius",
        "description": "Type: number\n半径"
      },
      {
        "name": "rotate",
        "description": "Type: number\n旋转角度\nDefault: 0\nSince: 2.5.0"
      },
      {
        "name": "scale",
        "description": "Type: number\n缩放级别，取值范围为3-20\nDefault: 16\nSince: 1.0.0"
      },
      {
        "name": "segmentTexts",
        "description": "Type: arrayobject\n分段文本\nSince: 2.22.0"
      },
      {
        "name": "setting",
        "description": "Type: Object\n配置项\nSince: 2.8.2"
      },
      {
        "name": "show-compass",
        "description": "Type: boolean\n显示指南针\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "show-location",
        "description": "Type: boolean\n显示带有方向的当前定位点，[3.10.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起需要用户位置授权。[3.13.2](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起如果开发者没有手动申请，则会自动申请\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "show-scale",
        "description": "Type: boolean\n显示比例尺，工具暂不支持\nDefault: false\nSince: 2.8.0"
      },
      {
        "name": "skew",
        "description": "Type: number\n倾斜角度，范围 0 ~ 40 , 关于 z 轴的倾角\nDefault: 0\nSince: 2.5.0"
      },
      {
        "name": "startIndex",
        "description": "Type: number\n起点"
      },
      {
        "name": "strokeColor",
        "description": "Type: string\n描边的颜色\nDefault: #ffffff\nSince: 2.3.0"
      },
      {
        "name": "strokeWidth",
        "description": "Type: number\n描边的宽度\nSince: 2.3.0"
      },
      {
        "name": "subkey",
        "description": "Type: string\n地图能力【个性化地图】使用的key，不支持动态修改\nSince: 2.3.0"
      },
      {
        "name": "textAlign",
        "description": "Type: string\n文本对齐方式。有效值: left, right, center\nSince: 1.6.0"
      },
      {
        "name": "textColor",
        "description": "Type: string\n文本颜色\nDefault: #000000"
      },
      {
        "name": "textStyle",
        "description": "Type: Object\n文字样式\nSince: 2.22.0"
      },
      {
        "name": "title",
        "description": "Type: string\n标注点名"
      },
      {
        "name": "top",
        "description": "Type: number\n距离地图的上边界多远"
      },
      {
        "name": "type",
        "description": "Type: string\n视野变化开始、结束时触发"
      },
      {
        "name": "width",
        "description": "Type: number\n控件宽度"
      },
      {
        "name": "x",
        "description": "Type: number\nlabel的坐标（废弃）\nSince: 1.2.0"
      },
      {
        "name": "y",
        "description": "Type: number\nlabel的坐标（废弃）\nSince: 1.2.0"
      },
      {
        "name": "zIndex",
        "description": "Type: number\n设置多边形 Z 轴数值\nSince: 2.3.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/map.html"
      }
    ]
  },
  {
    "name": "movable-area",
    "description": "可移动的视图容器，在页面中可以拖拽滑动。[movable-view](https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html)必须在 [movable-area](https://developers.weixin.qq.com/miniprogram/dev/component/movable-area.html) 组件中，并且必须是直接子节点，否则不能移动。",
    "attributes": [
      {
        "name": "animation",
        "description": "Type: boolean\n是否使用动画\nDefault: true\nSince: 2.1.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\n拖动过程中触发的事件，event.detail = {x, y, source}\nSince: 1.9.90"
      },
      {
        "name": "bindscale",
        "description": "Type: function => any\n缩放过程中触发的事件，event.detail = {x, y, scale}，x和y字段在[2.1.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)之后支持\nSince: 1.9.90"
      },
      {
        "name": "damping",
        "description": "Type: number\n阻尼系数，用于控制x或y改变时的动画和过界回弹的动画，值越大移动越快\nDefault: 20\nSince: 1.2.0"
      },
      {
        "name": "direction",
        "description": "Type: string\nmovable-view的移动方向，属性值有all、vertical、horizontal、none\nDefault: none\nSince: 1.2.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.9.90"
      },
      {
        "name": "friction",
        "description": "Type: number\n摩擦系数，用于控制惯性滑动的动画，值越大摩擦力越大，滑动越快停止；必须大于0，否则会被设置成默认值\nDefault: 2\nSince: 1.2.0"
      },
      {
        "name": "htouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为横向的移动时触发，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "inertia",
        "description": "Type: boolean\nmovable-view是否带有惯性\nDefault: false\nSince: 1.2.0"
      },
      {
        "name": "out-of-bounds",
        "description": "Type: boolean\n超过可移动区域后，movable-view是否还可以移动\nDefault: false\nSince: 1.2.0"
      },
      {
        "name": "scale",
        "description": "Type: boolean\n是否支持双指缩放，默认缩放手势生效区域是在movable-view内\nDefault: false\nSince: 1.9.90"
      },
      {
        "name": "scale-max",
        "description": "Type: number\n定义缩放倍数最大值\nDefault: 10\nSince: 1.9.90"
      },
      {
        "name": "scale-min",
        "description": "Type: number\n定义缩放倍数最小值\nDefault: 0.1\nSince: 1.9.90"
      },
      {
        "name": "scale-value",
        "description": "Type: number\n定义缩放倍数，取值范围为 0.1 - 10\nDefault: 1\nSince: 1.9.90"
      },
      {
        "name": "vtouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为纵向的移动时触发，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "x",
        "description": "Type: number | string\n定义x轴方向的偏移，如果x的值不在可移动范围内，会自动移动到可移动范围；改变x的值会触发动画；单位支持px（默认）、rpx；\nSince: 1.2.0"
      },
      {
        "name": "y",
        "description": "Type: number | string\n定义y轴方向的偏移，如果y的值不在可移动范围内，会自动移动到可移动范围；改变y的值会触发动画；单位支持px（默认）、rpx；\nSince: 1.2.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html"
      }
    ]
  },
  {
    "name": "movable-view",
    "description": "可移动的视图容器，在页面中可以拖拽滑动。[movable-view](https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html)必须在 [movable-area](https://developers.weixin.qq.com/miniprogram/dev/component/movable-area.html) 组件中，并且必须是直接子节点，否则不能移动。",
    "attributes": [
      {
        "name": "animation",
        "description": "Type: boolean\n是否使用动画\nDefault: true\nSince: 2.1.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\n拖动过程中触发的事件，event.detail = {x, y, source}\nSince: 1.9.90"
      },
      {
        "name": "bindscale",
        "description": "Type: function => any\n缩放过程中触发的事件，event.detail = {x, y, scale}，x和y字段在[2.1.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)之后支持\nSince: 1.9.90"
      },
      {
        "name": "damping",
        "description": "Type: number\n阻尼系数，用于控制x或y改变时的动画和过界回弹的动画，值越大移动越快\nDefault: 20\nSince: 1.2.0"
      },
      {
        "name": "direction",
        "description": "Type: string\nmovable-view的移动方向，属性值有all、vertical、horizontal、none\nDefault: none\nSince: 1.2.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.9.90"
      },
      {
        "name": "friction",
        "description": "Type: number\n摩擦系数，用于控制惯性滑动的动画，值越大摩擦力越大，滑动越快停止；必须大于0，否则会被设置成默认值\nDefault: 2\nSince: 1.2.0"
      },
      {
        "name": "htouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为横向的移动时触发，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "inertia",
        "description": "Type: boolean\nmovable-view是否带有惯性\nDefault: false\nSince: 1.2.0"
      },
      {
        "name": "out-of-bounds",
        "description": "Type: boolean\n超过可移动区域后，movable-view是否还可以移动\nDefault: false\nSince: 1.2.0"
      },
      {
        "name": "scale",
        "description": "Type: boolean\n是否支持双指缩放，默认缩放手势生效区域是在movable-view内\nDefault: false\nSince: 1.9.90"
      },
      {
        "name": "scale-max",
        "description": "Type: number\n定义缩放倍数最大值\nDefault: 10\nSince: 1.9.90"
      },
      {
        "name": "scale-min",
        "description": "Type: number\n定义缩放倍数最小值\nDefault: 0.1\nSince: 1.9.90"
      },
      {
        "name": "scale-value",
        "description": "Type: number\n定义缩放倍数，取值范围为 0.1 - 10\nDefault: 1\nSince: 1.9.90"
      },
      {
        "name": "vtouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为纵向的移动时触发，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "x",
        "description": "Type: number | string\n定义x轴方向的偏移，如果x的值不在可移动范围内，会自动移动到可移动范围；改变x的值会触发动画；单位支持px（默认）、rpx；\nSince: 1.2.0"
      },
      {
        "name": "y",
        "description": "Type: number | string\n定义y轴方向的偏移，如果y的值不在可移动范围内，会自动移动到可移动范围；改变y的值会触发动画；单位支持px（默认）、rpx；\nSince: 1.2.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/movable-view.html"
      }
    ]
  }
]
