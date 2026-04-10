// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MAP_AND_MOVABLE = [
  {
    "name": "map",
    "description": "地图。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。 个性化地图能力可在小程序后台“设置-开发者工具-腾讯位置服务”申请开通。 设置subkey后，小程序内的地图组件均会使用该底图效果，底图场景的切换会在后续版本提供。 详见[《小程序个性地图使用指南》](https://lbs.qq.com/product/miniapp/guide/)",
    "attributes": [
      {
        "name": "bindcallouttap",
        "description": "Type: function => any\n点击标记点对应的气泡时触发，会返回marker的id\nSince: 1.2.0"
      },
      {
        "name": "bindcontroltap",
        "description": "Type: function => any\n点击控件时触发，会返回control的id"
      },
      {
        "name": "bindmarkertap",
        "description": "Type: function => any\n点击标记点时触发，会返回marker的id"
      },
      {
        "name": "bindpoitap",
        "description": "Type: function => any\n点击地图poi点时触发\nSince: 2.3.0"
      },
      {
        "name": "bindregionchange",
        "description": "Type: function => any\n视野发生变化时触发\nSince: [2.3.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html \"基础库 2.3.0 开始支持，低版本需做兼容处理。\")起增加`causedBy` 参数区分拖动、缩放和调用接口等来源"
      },
      {
        "name": "bindtap",
        "description": "Type: function => any\n点击地图时触发"
      },
      {
        "name": "bindupdated",
        "description": "Type: function => any\n在地图渲染更新完成时触发\nSince: 1.6.0"
      },
      {
        "name": "circles",
        "description": "Type: Object\n圆"
      },
      {
        "name": "controls",
        "description": "Type: Object\n控件（即将废弃，建议使用 [cover-view](https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html) 代替）"
      },
      {
        "name": "covers",
        "description": "Type: any[]\n**即将移除，请使用 markers**"
      },
      {
        "name": "enable-3D",
        "description": "Type: boolean\n展示3D楼块(工具暂不支持）\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-overlooking",
        "description": "Type: boolean\n开启俯视\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-rotate",
        "description": "Type: boolean\n是否支持旋转\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "enable-scroll",
        "description": "Type: boolean\n是否支持拖动\nDefault: true\nSince: 2.3.0"
      },
      {
        "name": "enable-zoom",
        "description": "Type: boolean\n是否支持缩放\nDefault: true\nSince: 2.3.0"
      },
      {
        "name": "include-points",
        "description": "Type: any[]\n缩放视野以包含所有给定的坐标点"
      },
      {
        "name": "latitude",
        "description": "Type: number\n中心纬度"
      },
      {
        "name": "longitude",
        "description": "Type: number\n中心经度"
      },
      {
        "name": "markers",
        "description": "Type: Object\n标记点"
      },
      {
        "name": "polygons",
        "description": "Type: Object\n多边形\nSince: 2.3.0"
      },
      {
        "name": "polyline",
        "description": "Type: Object\n路线"
      },
      {
        "name": "scale",
        "description": "Type: number\n缩放级别，取值范围为5-18\nDefault: 16"
      },
      {
        "name": "show-compass",
        "description": "Type: boolean\n显示指南针\nDefault: false\nSince: 2.3.0"
      },
      {
        "name": "show-location",
        "description": "Type: boolean\n显示带有方向的当前定位点"
      },
      {
        "name": "subkey",
        "description": "Type: string\n个性化地图使用的key，仅初始化地图时有效\nDefault: ''\nSince: 2.3.0"
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
    "description": "`movable-view` 的可移动区域",
    "attributes": [
      {
        "name": "scale-area",
        "description": "Type: boolean\n当里面的movable-view设置为支持双指缩放时，设置此值可将缩放手势生效区域修改为整个movable-area\nDefault: false\nSince: 1.9.90"
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
    "description": "可移动的视图容器，在页面中可以拖拽滑动",
    "attributes": [
      {
        "name": "animation",
        "description": "Type: boolean\n是否使用动画\nDefault: true\nSince: 2.1.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\n拖动过程中触发的事件，event.detail = {x: x, y: y, source: source}，其中source表示产生移动的原因，值可为touch（拖动）、touch-out-of-bounds（超出移动范围）、out-of-bounds（超出移动范围后的回弹）、friction（惯性）和空字符串（setData）\nSince: 1.9.90"
      },
      {
        "name": "bindscale",
        "description": "Type: function => any\n缩放过程中触发的事件，event.detail = {x: x, y: y, scale: scale}，其中x和y字段在[2.1.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html \"基础库 2.1.0 开始支持，低版本需做兼容处理。\")之后开始支持返回\nSince: 1.9.90"
      },
      {
        "name": "damping",
        "description": "Type: number\n阻尼系数，用于控制x或y改变时的动画和过界回弹的动画，值越大移动越快\nDefault: 20"
      },
      {
        "name": "direction",
        "description": "Type: string\nmovable-view的移动方向，属性值有all、vertical、horizontal、none\nDefault: none"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.9.90"
      },
      {
        "name": "friction",
        "description": "Type: number\n摩擦系数，用于控制惯性滑动的动画，值越大摩擦力越大，滑动越快停止；必须大于0，否则会被设置成默认值\nDefault: 2"
      },
      {
        "name": "htouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为横向的移动，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "inertia",
        "description": "Type: boolean\nmovable-view是否带有惯性\nDefault: false"
      },
      {
        "name": "out-of-bounds",
        "description": "Type: boolean\n超过可移动区域后，movable-view是否还可以移动\nDefault: false"
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
        "description": "Type: number\n定义缩放倍数最小值\nDefault: 0.5\nSince: 1.9.90"
      },
      {
        "name": "scale-value",
        "description": "Type: number\n定义缩放倍数，取值范围为 0.5 - 10\nDefault: 1\nSince: 1.9.90"
      },
      {
        "name": "vtouchmove",
        "description": "Type: function => any\n初次手指触摸后移动为纵向的移动，如果catch此事件，则意味着touchmove事件也被catch\nSince: 1.9.90"
      },
      {
        "name": "x",
        "description": "Type: number | string\n定义x轴方向的偏移，如果x的值不在可移动范围内，会自动移动到可移动范围；改变x的值会触发动画"
      },
      {
        "name": "y",
        "description": "Type: number | string\n定义y轴方向的偏移，如果y的值不在可移动范围内，会自动移动到可移动范围；改变y的值会触发动画"
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
