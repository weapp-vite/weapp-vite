// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_VISUAL_VIEW = [
  {
    "name": "cover-image",
    "description": "覆盖在原生组件之上的图片视图，可覆盖的原生组件同`cover-view`，支持嵌套在cover-view里。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n图片加载失败时触发\nSince: 2.1.0"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n图片加载成功时触发\nSince: 2.1.0"
      },
      {
        "name": "src",
        "description": "Type: string\n图标路径，支持临时路径、网络地址（1.6.0起支持）、云文件ID（2.2.3起支持）。暂不支持base64格式。"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html"
      }
    ]
  },
  {
    "name": "cover-view",
    "description": "覆盖在原生组件之上的文本视图，可覆盖的原生组件包括`map`、`video`、`canvas`、`camera`、`live-player`、`live-pusher`，只支持嵌套`cover-view`、`cover-image`，可在`cover-view`中使用`button`。",
    "attributes": [
      {
        "name": "scroll-top",
        "description": "Type: number\n设置顶部滚动偏移量，仅在设置了 overflow-y: scroll 成为滚动元素后生效\nSince: 2.1.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html"
      }
    ]
  },
  {
    "name": "icon",
    "description": "图标。",
    "attributes": [
      {
        "name": "color",
        "description": "Type: string\nicon的颜色，同css的color"
      },
      {
        "name": "size",
        "description": "Type: number\nicon的大小，单位px\nDefault: 23"
      },
      {
        "name": "type",
        "description": "Type: string\nicon的类型，有效值：success, success_no_circle, info, warn, waiting, cancel, download, search, clear"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/icon.html"
      }
    ]
  },
  {
    "name": "rich-text",
    "description": "富文本。\n\n支持默认事件，包括：`tap`、`touchstart`、`touchmove`、`touchcancel`、`touchend`和`longtap`",
    "attributes": [
      {
        "name": "nodes",
        "description": "Type: any[] | string\n节点列表 / HTML String\nSince: 1.4.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/rich-text.html"
      }
    ]
  },
  {
    "name": "scroll-view",
    "description": "可滚动视图区域。\n\n使用竖向滚动时，需要给`<scroll-view/>`一个固定高度，通过 WXSS 设置 height。",
    "attributes": [
      {
        "name": "bindscroll",
        "description": "Type: function => any\n滚动时触发，event.detail = {scrollLeft, scrollTop, scrollHeight, scrollWidth, deltaX, deltaY}"
      },
      {
        "name": "bindscrolltolower",
        "description": "Type: function => any\n滚动到底部/右边，会触发 scrolltolower 事件"
      },
      {
        "name": "bindscrolltoupper",
        "description": "Type: function => any\n滚动到顶部/左边，会触发 scrolltoupper 事件"
      },
      {
        "name": "enable-back-to-top",
        "description": "Type: boolean\niOS点击顶部状态栏、安卓双击标题栏时，滚动条返回顶部，只支持竖向\nDefault: false"
      },
      {
        "name": "lower-threshold",
        "description": "Type: number\n距底部/右边多远时（单位px），触发 scrolltolower 事件\nDefault: 50"
      },
      {
        "name": "scroll-into-view",
        "description": "Type: string\n值应为某子元素id（id不能以数字开头）。设置哪个方向可滚动，则在哪个方向滚动到该元素"
      },
      {
        "name": "scroll-left",
        "description": "Type: number\n设置横向滚动条位置"
      },
      {
        "name": "scroll-top",
        "description": "Type: number\n设置竖向滚动条位置"
      },
      {
        "name": "scroll-with-animation",
        "description": "Type: boolean\n在设置滚动条位置时使用动画过渡\nDefault: false"
      },
      {
        "name": "scroll-x",
        "description": "Type: boolean\n允许横向滚动\nDefault: false"
      },
      {
        "name": "scroll-y",
        "description": "Type: boolean\n允许纵向滚动\nDefault: false"
      },
      {
        "name": "upper-threshold",
        "description": "Type: number\n距顶部/左边多远时（单位px），触发 scrolltoupper 事件\nDefault: 50"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html"
      }
    ]
  },
  {
    "name": "swiper",
    "description": "滑块视图容器。\n\n从 [1.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html \"基础库 1.4.0 开始支持，低版本需做兼容处理。\") 开始，`change`事件返回`detail`中包含一个`source`字段，表示导致变更的原因，可能值如下：\n\n*   `autoplay` 自动播放导致swiper变化；\n*   `touch` 用户划动引起swiper变化；\n*   其他原因将用空字符串表示。",
    "attributes": [
      {
        "name": "autoplay",
        "description": "Type: boolean\n是否自动切换\nDefault: false"
      },
      {
        "name": "bindanimationfinish",
        "description": "Type: function => any\n动画结束时会触发 animationfinish 事件，event.detail 同上\nSince: 1.9.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\ncurrent 改变时会触发 change 事件，event.detail = {current: current, source: source}"
      },
      {
        "name": "circular",
        "description": "Type: boolean\n是否采用衔接滑动\nDefault: false"
      },
      {
        "name": "current",
        "description": "Type: number\n当前所在滑块的 index\nDefault: 0"
      },
      {
        "name": "current-item-id",
        "description": "Type: string\n当前所在滑块的 item-id ，不能与 current 被同时指定\nSince: 1.9.0"
      },
      {
        "name": "display-multiple-items",
        "description": "Type: number\n同时显示的滑块数量\nDefault: 1\nSince: 1.9.0"
      },
      {
        "name": "duration",
        "description": "Type: number\n滑动动画时长\nDefault: 500"
      },
      {
        "name": "indicator-active-color",
        "description": "Type: string\n当前选中的指示点颜色\nDefault: #000000\nSince: 1.1.0"
      },
      {
        "name": "indicator-color",
        "description": "Type: string\n指示点颜色\nDefault: rgba(0, 0, 0, .3)\nSince: 1.1.0"
      },
      {
        "name": "indicator-dots",
        "description": "Type: boolean\n是否显示面板指示点\nDefault: false"
      },
      {
        "name": "interval",
        "description": "Type: number\n自动切换时间间隔\nDefault: 5000"
      },
      {
        "name": "next-margin",
        "description": "Type: string\n后边距，可用于露出后一项的一小部分，接受 px 和 rpx 值\nDefault: 0px\nSince: 1.9.0"
      },
      {
        "name": "previous-margin",
        "description": "Type: string\n前边距，可用于露出前一项的一小部分，接受 px 和 rpx 值\nDefault: 0px\nSince: 1.9.0"
      },
      {
        "name": "skip-hidden-item-layout",
        "description": "Type: boolean\n是否跳过未显示的滑块布局，设为 true 可优化复杂情况下的滑动性能，但会丢失隐藏状态滑块的布局信息\nDefault: false\nSince: 1.9.0"
      },
      {
        "name": "vertical",
        "description": "Type: boolean\n滑动方向是否为纵向\nDefault: false"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html"
      }
    ]
  },
  {
    "name": "swiper-item",
    "description": "仅可放置在`<swiper/>`组件中，宽高自动设置为100%。",
    "attributes": [
      {
        "name": "item-id",
        "description": "Type: string\n该 swiper-item 的标识符\nSince: 1.9.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/swiper.html"
      }
    ]
  },
  {
    "name": "text",
    "description": "文本。",
    "attributes": [
      {
        "name": "decode",
        "description": "Type: boolean\n是否解码\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "selectable",
        "description": "Type: boolean\n文本是否可选\nDefault: false\nSince: 1.1.0"
      },
      {
        "name": "space",
        "description": "Type: string\n显示连续空格\nDefault: false\nSince: 1.4.0",
        "values": [
          {
            "name": "ensp",
            "description": "中文字符空格一半大小"
          },
          {
            "name": "emsp",
            "description": "中文字符空格大小"
          },
          {
            "name": "nbsp",
            "description": "根据字体设置的空格大小"
          }
        ]
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/text.html"
      }
    ]
  },
  {
    "name": "view",
    "description": "视图容器。",
    "attributes": [
      {
        "name": "hover-class",
        "description": "Type: string\n指定按下去的样式类。当 `hover-class=\"none\"` 时，没有点击态效果\nDefault: none"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\n按住后多久出现点击态，单位毫秒\nDefault: 50"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\n手指松开后点击态保留时间，单位毫秒\nDefault: 400"
      },
      {
        "name": "hover-stop-propagation",
        "description": "Type: boolean\n指定是否阻止本节点的祖先节点出现点击态\nDefault: false\nSince: 1.5.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/view.html"
      }
    ]
  }
]
