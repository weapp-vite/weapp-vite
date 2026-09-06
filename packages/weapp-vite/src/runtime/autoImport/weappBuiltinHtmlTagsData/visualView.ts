// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_VISUAL_VIEW = [
  {
    "name": "cover-image",
    "description": "覆盖在原生组件之上的图片视图。",
    "attributes": [
      {
        "name": "bind:error",
        "description": "Type: eventhandle\n图片加载失败时触发\nSince: 2.1.0"
      },
      {
        "name": "bind:load",
        "description": "Type: eventhandle\n图片加载成功时触发\nSince: 2.1.0"
      },
      {
        "name": "referrer-policy",
        "description": "Type: string\nDefault: no-referrer\nSince: 2.13.0"
      },
      {
        "name": "src",
        "description": "Type: string\n图标路径\nSince: 1.4.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/cover-image.html"
      }
    ]
  },
  {
    "name": "cover-view",
    "description": "覆盖在原生组件之上的文本视图。\n可覆盖的原生组件包括 [map](https://developers.weixin.qq.com/miniprogram/dev/component/map.html)、[video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html)、[canvas](https://developers.weixin.qq.com/miniprogram/dev/component/canvas.html)、[camera](https://developers.weixin.qq.com/miniprogram/dev/component/camera.html)、[live-player](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)、[live-pusher](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html)\n只支持嵌套 [cover-view](https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html)、[cover-image](https://developers.weixin.qq.com/miniprogram/dev/component/cover-image.html)，可在 [cover-view](https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html) 中使用 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html)。组件属性的长度单位默认为px，[2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持传入单位(rpx/px)。",
    "attributes": [
      {
        "name": "scroll-top",
        "description": "Type: number | string\n设置顶部滚动偏移量，仅在设置了 overflow-y: scroll 成为滚动元素后生效\nSince: 2.1.0"
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
    "description": "图标组件",
    "attributes": [
      {
        "name": "color",
        "description": "Type: string\nicon的颜色，同css的color\nSince: 1.0.0"
      },
      {
        "name": "size",
        "description": "Type: number | string\nicon的大小，单位默认为px，[2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持传入单位(rpx/px)，[2.21.3](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持传入其余单位(rem 等)。\nDefault: 23\nSince: 1.0.0"
      },
      {
        "name": "type",
        "description": "Type: string\nicon的类型，有效值：success, success_no_circle, info, warn, waiting, cancel, download, search, clear\nSince: 1.0.0"
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
    "description": "富文本。\n自基础库 2.33.0 版本开始支持（3.0.0 除外）。\n遵循 skyline 的样式和布局规则，html tag 被映射成类似 text/span/view 节点，因此存在 text 嵌套问题。\n不支持 td/tr 等表格布局 tag，也不支持 bdo/bdi 等文字排版 tag。建议完全使用 flex 等 skyline 支持的布局方式来创建富文本内容。\n提供了可选的兼容布局模式选项 `mode`，但仍不保证与 WebView 表现 100% 一致。\n在 2.33.0 基础库下，请尽可能避免为 html tag 使用 wx-rich-text 开头的类名。",
    "attributes": [
      {
        "name": "attrs",
        "description": "Type: Object\n属性"
      },
      {
        "name": "children",
        "description": "Type: any[]\n子节点列表"
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: default",
        "values": [
          {
            "name": "default",
            "description": "完全遵循 skyline 的默认行为，不对节点树进行任何更改。"
          },
          {
            "name": "compat",
            "description": "尽可能将 tag 映射为 `<view><span></span></view>` 的形式。通常最接近 webview 的表现。"
          },
          {
            "name": "aggressive",
            "description": "所有 tag 均被映射为形如 `<view><span></span></view>` 的形式。"
          },
          {
            "name": "inline-block",
            "description": "实验性的 inline-block 布局策略，但无法实现折行。"
          },
          {
            "name": "web",
            "description": "使用 webview 渲染富文本，基础库 3.6.0 开始支持。"
          },
          {
            "name": "web-static",
            "description": "使用 webview 截图的方式渲染富文本，基础库 3.7.7 开始支持。"
          }
        ]
      },
      {
        "name": "name",
        "description": "Type: string\n标签名"
      },
      {
        "name": "nodes",
        "description": "Type: any[] | string\nDefault: []\nSince: 1.4.0"
      },
      {
        "name": "space",
        "description": "Type: string\nSince: 2.4.1",
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
      },
      {
        "name": "text",
        "description": "Type: string\n文本"
      },
      {
        "name": "user-select",
        "description": "Type: boolean\nDefault: false\nSince: 2.24.0"
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
    "description": "可滚动视图区域。使用竖向滚动时，需要给[scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html)一个固定高度，通过 WXSS 设置 height。组件属性的长度单位默认为px，[2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持传入单位(rpx/px)。\n横向滚动需打开 enable-flex 以兼容 WebView，如 <scroll-view scroll-x enable-flex style=\"flex-direction: row;\"/>\n滚动条的长度是预估的，若直接子节点的高度差别较大，则滚动条长度可能会不准确\n使用 `worklet` 函数需要开启开发者工具 \"将 JS 编译成 ES5\" 或 \"编译 worklet 函数\" 选项。",
    "attributes": [
      {
        "name": "associative-container",
        "description": "Type: string",
        "values": [
          {
            "name": "draggable-sheet",
            "description": "关联 [draggable-sheet](https://developers.weixin.qq.com/miniprogram/dev/component/draggable-sheet.html) 组件"
          },
          {
            "name": "nested-scroll-view",
            "description": "关联 `type=nested` 嵌套模式"
          },
          {
            "name": "pop-gesture",
            "description": "关联 [页面手势返回](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/pop-gesture.html)"
          }
        ]
      },
      {
        "name": "bind:refresherstatuschange",
        "description": "Type: function => any"
      },
      {
        "name": "bind:refresherwillrefresh",
        "description": "Type: function => any"
      },
      {
        "name": "bind:scroll",
        "description": "Type: function => any"
      },
      {
        "name": "bind:scrollend",
        "description": "Type: function => any"
      },
      {
        "name": "bind:scrollstart",
        "description": "Type: function => any"
      },
      {
        "name": "binddragend",
        "description": "Type: function => any\n滑动结束事件 (同时开启 enhanced 属性后生效) detail { scrollTop, scrollLeft, velocity }\nSince: 2.12.0"
      },
      {
        "name": "binddragging",
        "description": "Type: function => any\n滑动事件 (同时开启 enhanced 属性后生效) detail { scrollTop, scrollLeft }\nSince: 2.12.0"
      },
      {
        "name": "binddragstart",
        "description": "Type: function => any\n滑动开始事件 (同时开启 enhanced 属性后生效) detail { scrollTop, scrollLeft }\nSince: 2.12.0"
      },
      {
        "name": "bindrefresherabort",
        "description": "Type: function => any\n自定义下拉刷新被中止\nSince: 2.10.1"
      },
      {
        "name": "bindrefresherpulling",
        "description": "Type: function => any\n自定义下拉刷新控件被下拉\nSince: 2.10.1"
      },
      {
        "name": "bindrefresherrefresh",
        "description": "Type: function => any\n自定义下拉刷新被触发\nSince: 2.10.1"
      },
      {
        "name": "bindrefresherrestore",
        "description": "Type: function => any\n自定义下拉刷新被复位\nSince: 2.10.1"
      },
      {
        "name": "bindscroll",
        "description": "Type: function => any\n滚动时触发，event.detail = { scrollLeft, scrollTop, scrollHeight, scrollWidth, deltaX, deltaY }。skyline 从 3.6.6开始，额外具有 boundaryVelocity 字段：如果该次滚动会触碰到边界，从该次滚动触发起到下一个滚动事件发生或者当次滚动事件结束为止 boundaryVelocity 将被置为触碰边界时的速度，否则置为 NAN。\nSince: 1.0.0"
      },
      {
        "name": "bindscrolltolower",
        "description": "Type: function => any\n滚动到底部/右边时触发\nSince: 1.0.0"
      },
      {
        "name": "bindscrolltoupper",
        "description": "Type: function => any\n滚动到顶部/左边时触发\nSince: 1.0.0"
      },
      {
        "name": "bounces",
        "description": "Type: boolean\niOS 下 scroll-view 边界弹性控制 (同时开启 enhanced 属性后生效)\nDefault: true\nSince: 2.12.0"
      },
      {
        "name": "cache-extent",
        "description": "Type: number"
      },
      {
        "name": "clip",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "enable-back-to-top",
        "description": "Type: boolean\niOS点击顶部状态栏、安卓双击标题栏时，滚动条返回顶部，只支持竖向。自 2.27.3 版本开始，若非显式设置为 false，则在显示尺寸大于屏幕 90% 时自动开启。鸿蒙 OS 暂不支持\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "enable-flex",
        "description": "Type: boolean\n启用 flexbox 布局。开启后，当前节点声明了 `display: flex` 就会成为 flex container，并作用于其孩子节点。\nDefault: false\nSince: 2.7.3"
      },
      {
        "name": "enable-passive",
        "description": "Type: boolean\n开启 passive 特性，能优化一定的滚动性能\nDefault: false\nSince: 2.25.3"
      },
      {
        "name": "enhanced",
        "description": "Type: boolean\n启用 scroll-view 增强特性，启用后可通过 [ScrollViewContext](https://developers.weixin.qq.com/miniprogram/dev/api/ui/scroll/ScrollViewContext.html) 操作 scroll-view。鸿蒙 OS 暂不支持 enhanced 及其相关的属性和方法。\nDefault: false\nSince: 2.12.0"
      },
      {
        "name": "fast-deceleration",
        "description": "Type: boolean\n滑动减速速率控制, 仅在 iOS 下生效 (同时开启 enhanced 属性后生效)\nDefault: false\nSince: 2.12.0"
      },
      {
        "name": "lower-threshold",
        "description": "Type: number | string\n距底部/右边多远时，触发 scrolltolower 事件\nDefault: 50\nSince: 1.0.0"
      },
      {
        "name": "min-drag-distance",
        "description": "Type: number\nDefault: 18"
      },
      {
        "name": "padding",
        "description": "Type: any[]\nDefault: [0, 0, 0, 0]"
      },
      {
        "name": "paging-enabled",
        "description": "Type: boolean\n分页滑动效果 (同时开启 enhanced 属性后生效)\nDefault: false\nSince: 2.12.0"
      },
      {
        "name": "refresher-background",
        "description": "Type: string\n设置自定义下拉刷新区域背景颜色，默认为透明\nSince: 2.10.1"
      },
      {
        "name": "refresher-ballistic-refresh-enabled",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "refresher-default-style",
        "description": "Type: string\n设置自定义下拉刷新默认样式，支持设置 `black | white | none`， none 表示不使用默认样式\nDefault: \"black\"\nSince: 2.10.1"
      },
      {
        "name": "refresher-enabled",
        "description": "Type: boolean\n开启自定义下拉刷新\nDefault: false\nSince: 2.10.1"
      },
      {
        "name": "refresher-threshold",
        "description": "Type: number\n设置自定义下拉刷新阈值\nDefault: 45\nSince: 2.10.1"
      },
      {
        "name": "refresher-triggered",
        "description": "Type: boolean\n设置当前下拉刷新状态，true 表示下拉刷新已经被触发，false 表示下拉刷新未被触发\nDefault: false\nSince: 2.10.1"
      },
      {
        "name": "refresher-two-level-close-threshold",
        "description": "Type: number\nDefault: 80"
      },
      {
        "name": "refresher-two-level-enabled",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "refresher-two-level-pinned",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "refresher-two-level-scroll-enabled",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "refresher-two-level-threshold",
        "description": "Type: number\nDefault: 150"
      },
      {
        "name": "refresher-two-level-triggered",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "reverse",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "scroll-anchoring",
        "description": "Type: boolean\n开启 scroll anchoring 特性，即控制滚动位置不随内容变化而抖动，可参考 CSS `overflow-anchor` 属性。webview 仅在 iOS 下生效。skyline 自 3.6.2 版本开始支持，默认为 true 。\nDefault: false\nSince: 2.8.2"
      },
      {
        "name": "scroll-into-view",
        "description": "Type: string\n值应为某子元素id（id不能以数字开头）。设置哪个方向可滚动，则在哪个方向滚动到该元素\nSince: 1.0.0"
      },
      {
        "name": "scroll-into-view-alignment",
        "description": "Type: string\nDefault: start",
        "values": [
          {
            "name": "start",
            "description": "目标节点显示在视口开始处"
          },
          {
            "name": "center",
            "description": "目标节点显示在视口中间"
          },
          {
            "name": "end",
            "description": "目标节点显示在视口结束处"
          },
          {
            "name": "nearest",
            "description": "目标节点在就近的视口边缘显示，若节点已在视口内则不触发滚动"
          }
        ]
      },
      {
        "name": "scroll-into-view-offset",
        "description": "Type: number\n跳转到 scroll-into-view 目标节点时的额外偏移。skyline 自 3.1.0 版本开始支持，webview 自 3.6.0 版本开始支持。\nDefault: 0\nSince: 3.1.0"
      },
      {
        "name": "scroll-into-view-within-extent",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "scroll-left",
        "description": "Type: number | string\n设置横向滚动条位置\nSince: 1.0.0"
      },
      {
        "name": "scroll-top",
        "description": "Type: number | string\n设置竖向滚动条位置\nSince: 1.0.0"
      },
      {
        "name": "scroll-with-animation",
        "description": "Type: boolean\n在设置滚动条位置时使用动画过渡\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "scroll-x",
        "description": "Type: boolean\n允许横向滚动\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "scroll-y",
        "description": "Type: boolean\n允许纵向滚动\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "show-scrollbar",
        "description": "Type: boolean\n滚动条显隐控制，仅对垂直滚动条有效 (同时开启 enhanced 属性后生效)\nDefault: true\nSince: 2.12.0"
      },
      {
        "name": "type",
        "description": "Type: string",
        "values": [
          {
            "name": "list",
            "description": "列表模式。只会渲染在屏节点，会根据直接子节点是否在屏来按需渲染，若只有一个直接子节点则性能会退化"
          },
          {
            "name": "custom",
            "description": "自定义模式。只会渲染在屏节点，子节点可以是 [sticky-section](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-section.html) [list-view](https://developers.weixin.qq.com/miniprogram/dev/component/list-view.html) [grid-view](https://developers.weixin.qq.com/miniprogram/dev/component/grid-view.html) 等组件"
          },
          {
            "name": "nested",
            "description": "嵌套模式。用于处理父子 scroll-view 间的嵌套滚动，子节点可以是 [nested-scroll-header](https://developers.weixin.qq.com/miniprogram/dev/component/nested-scroll-header.html) [nested-scroll-body](https://developers.weixin.qq.com/miniprogram/dev/component/nested-scroll-body.html) 组件或自定义 refresher"
          }
        ]
      },
      {
        "name": "upper-threshold",
        "description": "Type: number | string\n距顶部/左边多远时，触发 scrolltoupper 事件\nDefault: 50\nSince: 1.0.0"
      },
      {
        "name": "using-sticky",
        "description": "Type: boolean\n使 scroll-view 下的 position sticky 特性生效，否则滚动一屏后 sticky 元素会被隐藏\nDefault: false\nSince: 3.2.1"
      },
      {
        "name": "worklet:adjust-deceleration-velocity",
        "description": "Type: function => any"
      },
      {
        "name": "worklet:onscrollend",
        "description": "Type: function => any"
      },
      {
        "name": "worklet:onscrollstart",
        "description": "Type: function => any"
      },
      {
        "name": "worklet:onscrollupdate",
        "description": "Type: function => any"
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
    "description": "滑块视图容器。其中只可放置[swiper-item](https://developers.weixin.qq.com/miniprogram/dev/component/swiper-item.html)组件，否则会导致未定义的行为。\n使用 `worklet` 函数需要开启开发者工具 \"将 JS 编译成 ES5\" 或 \"编译 worklet 函数\" 选项。",
    "attributes": [
      {
        "name": "autoplay",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "bindanimationfinish",
        "description": "Type: function => any\nSince: 1.9.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindtransition",
        "description": "Type: function => any\nSince: 2.4.3"
      },
      {
        "name": "cache-extent",
        "description": "Type: number\nDefault: 0\nSince: 2.29.0"
      },
      {
        "name": "circular",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "current",
        "description": "Type: number\nDefault: 0\nSince: 1.0.0"
      },
      {
        "name": "direction",
        "description": "Type: string\nDefault: \"all\"\nSince: 3.8.10",
        "values": [
          {
            "name": "all",
            "description": "默认"
          },
          {
            "name": "positive",
            "description": "如 vertical 为 true 时，允许用户下滑（swiper 内容向上滚动），为 false 时，允许用户右滑（swiper 内容向左滚动）"
          },
          {
            "name": "negative",
            "description": "如 vertical 为 true 时，允许用户上滑（swiper 内容向下滚动），为 false 时，允许用户左滑（swiper 内容向右滚动）"
          }
        ]
      },
      {
        "name": "display-multiple-items",
        "description": "Type: number\nDefault: 1\nSince: 1.9.0"
      },
      {
        "name": "duration",
        "description": "Type: number\nDefault: 500\nSince: 1.0.0"
      },
      {
        "name": "easing-function",
        "description": "Type: string\nDefault: \"default\"\nSince: 2.6.5",
        "values": [
          {
            "name": "default",
            "description": "默认缓动函数"
          },
          {
            "name": "linear",
            "description": "线性动画"
          },
          {
            "name": "easeInCubic",
            "description": "缓入动画"
          },
          {
            "name": "easeOutCubic",
            "description": "缓出动画"
          },
          {
            "name": "easeInOutCubic",
            "description": "缓入缓出动画"
          }
        ]
      },
      {
        "name": "indicator-active-color",
        "description": "Type: string\nDefault: #000000\nSince: 1.1.0"
      },
      {
        "name": "indicator-alignment",
        "description": "Type: number[] | string\nDefault: auto\nSince: 3.2.0"
      },
      {
        "name": "indicator-color",
        "description": "Type: string\nDefault: rgba(0, 0, 0, .3)\nSince: 1.1.0"
      },
      {
        "name": "indicator-dots",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "indicator-height",
        "description": "Type: number\nDefault: 8\nSince: 3.2.0"
      },
      {
        "name": "indicator-margin",
        "description": "Type: number\nDefault: 10\nSince: 3.2.0"
      },
      {
        "name": "indicator-offset",
        "description": "Type: number[]\nDefault: [0, 0]\nSince: 3.2.0"
      },
      {
        "name": "indicator-radius",
        "description": "Type: number\nDefault: 4\nSince: 3.2.0"
      },
      {
        "name": "indicator-spacing",
        "description": "Type: number\nDefault: 4\nSince: 3.2.0"
      },
      {
        "name": "indicator-type",
        "description": "Type: string\nDefault: normal\nSince: 3.2.0",
        "values": [
          {
            "name": "normal"
          },
          {
            "name": "worm"
          },
          {
            "name": "wormThin"
          },
          {
            "name": "wormUnderground"
          },
          {
            "name": "wormThinUnderground"
          },
          {
            "name": "expand"
          },
          {
            "name": "jump"
          },
          {
            "name": "jumpWithOffset"
          },
          {
            "name": "scroll"
          },
          {
            "name": "scrollFixedCenter"
          },
          {
            "name": "slide"
          },
          {
            "name": "slideUnderground"
          },
          {
            "name": "scale"
          },
          {
            "name": "swap"
          },
          {
            "name": "swapYRotation"
          },
          {
            "name": "color"
          }
        ]
      },
      {
        "name": "indicator-width",
        "description": "Type: number\nDefault: 8\nSince: 3.2.0"
      },
      {
        "name": "interval",
        "description": "Type: number\nDefault: 5000\nSince: 1.0.0"
      },
      {
        "name": "layout-type",
        "description": "Type: string\nDefault: normal\nSince: 3.2.0",
        "values": [
          {
            "name": "normal",
            "description": "默认方式"
          },
          {
            "name": "stackLeft",
            "description": "左向堆叠"
          },
          {
            "name": "stackRight",
            "description": "右向堆叠"
          },
          {
            "name": "tinder",
            "description": "滑动卡片"
          },
          {
            "name": "transformer",
            "description": "过渡动画"
          }
        ]
      },
      {
        "name": "next-margin",
        "description": "Type: string\nDefault: \"0px\"\nSince: 1.9.0"
      },
      {
        "name": "previous-margin",
        "description": "Type: string\nDefault: \"0px\"\nSince: 1.9.0"
      },
      {
        "name": "scroll-with-animation",
        "description": "Type: boolean\nDefault: true\nSince: 2.29.0"
      },
      {
        "name": "snap-to-edge",
        "description": "Type: boolean\n当 swiper-item 的个数大于等于 2，关闭 circular 并且开启 previous-margin 或 next-margin 的时候，可以指定这个边距是否应用到第一个、最后一个元素\nDefault: false\nSince: 2.12.1"
      },
      {
        "name": "transformer-type",
        "description": "Type: string\nDefault: scaleAndFade\nSince: 3.2.0",
        "values": [
          {
            "name": "scaleAndFade"
          },
          {
            "name": "accordion"
          },
          {
            "name": "threeD"
          },
          {
            "name": "zoomIn"
          },
          {
            "name": "zoomOut"
          },
          {
            "name": "deepthPage"
          }
        ]
      },
      {
        "name": "vertical",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "worklet:onscrollend",
        "description": "Type: function => any"
      },
      {
        "name": "worklet:onscrollstart",
        "description": "Type: function => any"
      },
      {
        "name": "worklet:onscrollupdate",
        "description": "Type: function => any"
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
    "description": "仅可放置在 swiper 组件中，宽高自动设置为 100%。",
    "attributes": [
      {
        "name": "item-id",
        "description": "Type: string\n该 swiper-item 的标识符\nSince: 1.9.0"
      },
      {
        "name": "skip-hidden-item-layout",
        "description": "Type: boolean\n是否跳过未显示的滑块布局\nDefault: false\nSince: 1.9.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/swiper-item.html"
      }
    ]
  },
  {
    "name": "text",
    "description": "文本。\n内联文本只能用 text 组件，不能用 view，如 <text> foo <text>bar</text> </text>\n新增 span 组件用于内联文本和图片，如 <span> <image> </image> <text>bar</text> </span>",
    "attributes": [
      {
        "name": "decode",
        "description": "Type: boolean\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "max-lines",
        "description": "Type: number"
      },
      {
        "name": "overflow",
        "description": "Type: string\nDefault: visible",
        "values": [
          {
            "name": "clip",
            "description": "修剪文本"
          },
          {
            "name": "fade",
            "description": "淡出"
          },
          {
            "name": "ellipsis",
            "description": "显示省略号"
          },
          {
            "name": "visible",
            "description": "文本不截断"
          }
        ]
      },
      {
        "name": "selectable",
        "description": "Type: boolean\n文本是否可选 (已废弃)\nDefault: false\nSince: 1.1.0"
      },
      {
        "name": "space",
        "description": "Type: string\nSince: 1.4.0",
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
      },
      {
        "name": "user-select",
        "description": "Type: boolean\n文本是否可选，该属性会使文本节点显示为 inline-block\nDefault: false\nSince: 2.12.1"
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
    "description": "视图容器",
    "attributes": [
      {
        "name": "bindtap",
        "description": "Type: eventhandle"
      },
      {
        "name": "hover-class",
        "description": "Type: string\n指定按下去的样式类。当 `hover-class=\"none\"` 时，没有点击态效果\nDefault: none\nSince: 1.0.0"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\n按住后多久出现点击态，单位毫秒\nDefault: 50\nSince: 1.0.0"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\n手指松开后点击态保留时间，单位毫秒\nDefault: 400\nSince: 1.0.0"
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
