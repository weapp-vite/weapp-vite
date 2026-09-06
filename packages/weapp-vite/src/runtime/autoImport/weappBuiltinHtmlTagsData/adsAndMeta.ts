// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_ADS_AND_META = [
  {
    "name": "ad",
    "description": "Banner 广告。",
    "attributes": [
      {
        "name": "ad-intervals",
        "description": "Type: number\n广告自动刷新的间隔时间，单位为秒，参数值必须大于等于30（该参数不传入时 Banner 广告不会自动刷新）\nSince: 2.3.1"
      },
      {
        "name": "ad-theme",
        "description": "Type: string\nDefault: white\nSince: 2.8.0"
      },
      {
        "name": "ad-type",
        "description": "Type: string\n广告类型，默认为展示banner，可通过设置该属性为`video`展示视频广告, `grid`为格子广告\nDefault: banner\nSince: 2.8.0"
      },
      {
        "name": "bindclose",
        "description": "Type: function => any\n广告关闭的回调\nSince: 2.6.5"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n广告加载失败的回调，event.detail = {errCode: 1002}\nSince: 2.2.1"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n广告加载成功的回调\nSince: 2.2.1"
      },
      {
        "name": "unit-id",
        "description": "Type: string\n广告单元id，可在[小程序管理后台](https://mp.weixin.qq.com/)的流量主模块新建\nSince: 1.9.94"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/ad.html"
      }
    ]
  },
  {
    "name": "ad-custom",
    "description": "原生模板 广告。",
    "attributes": [
      {
        "name": "ad-intervals",
        "description": "Type: number\n广告自动刷新的间隔时间，单位为秒，参数值必须大于等于30（该参数不传入时 模板 广告不会自动刷新）\nSince: 2.10.4"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n广告加载失败的回调，event.detail = {errCode: 1002}\nSince: 2.10.4"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n广告加载成功的回调\nSince: 2.10.4"
      },
      {
        "name": "unit-id",
        "description": "Type: string\n广告单元id，可在[小程序管理后台](https://mp.weixin.qq.com/)的流量主模块新建\nSince: 2.10.4"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html"
      }
    ]
  },
  {
    "name": "block",
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/conditional.html#block-wx-if"
      }
    ]
  },
  {
    "name": "match-media",
    "description": "media query 匹配检测节点。可以指定一组 media query 规则，满足时，这个节点才会被展示。\n通过这个节点可以实现“页面宽高在某个范围时才展示某个区域”这样的效果。",
    "attributes": [
      {
        "name": "height",
        "description": "Type: number\n页面高度（ px 为单位）\nSince: 2.11.1"
      },
      {
        "name": "max-height",
        "description": "Type: number\n页面最大高度（ px 为单位）\nSince: 2.11.1"
      },
      {
        "name": "max-width",
        "description": "Type: number\n页面最大宽度（ px 为单位）\nSince: 2.11.1"
      },
      {
        "name": "min-height",
        "description": "Type: number\n页面最小高度（ px 为单位）\nSince: 2.11.1"
      },
      {
        "name": "min-width",
        "description": "Type: number\n页面最小宽度（ px 为单位）\nSince: 2.11.1"
      },
      {
        "name": "orientation",
        "description": "Type: string\n屏幕方向（ `landscape` 或 `portrait` ）\nSince: 2.11.1"
      },
      {
        "name": "width",
        "description": "Type: number\n页面宽度（ px 为单位）\nSince: 2.11.1"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/match-media.html"
      }
    ]
  },
  {
    "name": "navigation-bar",
    "description": "页面导航条配置节点，用于指定导航栏的一些属性。只能是 [page-meta](https://developers.weixin.qq.com/miniprogram/dev/component/page-meta.html) 组件内的第一个节点，需要配合它一同使用。\n通过这个节点可以获得类似于调用 [`wx.setNavigationBarTitle`](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarTitle.html) [`wx.setNavigationBarColor`](https://developers.weixin.qq.com/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarColor.html) 等接口调用的效果。",
    "attributes": [
      {
        "name": "background-color",
        "description": "Type: string\n导航条背景颜色值，有效值为十六进制颜色\nSince: 2.9.0"
      },
      {
        "name": "color-animation-duration",
        "description": "Type: number\n改变导航栏颜色时的动画时长，默认为 `0` （即没有动画效果）\nDefault: 0\nSince: 2.9.0"
      },
      {
        "name": "color-animation-timing-func",
        "description": "Type: string\n改变导航栏颜色时的动画方式，支持 `linear` 、 `easeIn` 、 `easeOut` 和 `easeInOut`\nDefault: \"linear\"\nSince: 2.9.0"
      },
      {
        "name": "front-color",
        "description": "Type: string\n导航条前景颜色值，包括按钮、标题、状态栏的颜色，仅支持 `#ffffff` 和 `#000000`\nSince: 2.9.0"
      },
      {
        "name": "loading",
        "description": "Type: boolean\n是否在导航条显示 loading 加载提示\nDefault: false\nSince: 2.9.0"
      },
      {
        "name": "title",
        "description": "Type: string\n导航条标题\nSince: 2.9.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/navigation-bar.html"
      }
    ]
  },
  {
    "name": "official-account",
    "description": "公众号关注组件。当用户扫[小程序码](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/qr-code.html?t=19032815)打开小程序时，开发者可在小程序内配置公众号关注组件，方便用户快捷关注公众号，可嵌套在原生组件内。\n基础库 `2.18.1` 起，公众号关注组件显示场景值变更如下：\n小程序场景值命中以下值时，可展示关注公众号组件：\n1011 扫描二维码\n1017 前往小程序体验版的入口页\n1025 扫描一维码\n1047 扫描小程序码\n1124 扫“一物一码”打开小程序\n小程序热启动场景值命中以下值时，冷启动场景值在【1011、1017、1025、1047、1124】中，可展示关注公众号组件：\n1001 发现栏小程序主入口，「最近使用」列表\n1038 从另一个小程序返回\n1041 从插件小程序返回小程序\n1089 微信聊天主界面下拉，「最近使用」栏\n1090 长按小程序右上角菜单唤出最近使用历史\n1104 微信聊天主界面下拉，「我的小程序」栏\n1131 浮窗\n1187 新版浮窗，微信8.0起",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n组件加载失败时触发"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n组件加载成功时触发"
      },
      {
        "name": "errMsg",
        "description": "Type: string\n错误信息"
      },
      {
        "name": "status",
        "description": "Type: number\n状态码"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/official-account.html"
      }
    ]
  },
  {
    "name": "open-data",
    "description": "用于展示微信开放的数据。",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any"
      },
      {
        "name": "default-avatar",
        "description": "Type: string"
      },
      {
        "name": "default-text",
        "description": "Type: string"
      },
      {
        "name": "lang",
        "description": "Type: string\nDefault: en",
        "values": [
          {
            "name": "en",
            "description": "英文"
          },
          {
            "name": "zh_CN",
            "description": "简体中文"
          },
          {
            "name": "zh_TW",
            "description": "繁体中文"
          }
        ]
      },
      {
        "name": "open-gid",
        "description": "Type: string"
      },
      {
        "name": "type",
        "description": "Type: string",
        "values": [
          {
            "name": "groupName",
            "description": "拉取群名称"
          }
        ]
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/open-data.html"
      }
    ]
  },
  {
    "name": "page-container",
    "description": "页面容器。\n小程序如果在页面内进行复杂的界面设计（如在页面内弹出半屏的弹窗、在页面内加载一个全屏的子页面等），用户进行返回操作会直接离开当前页面，不符合用户预期，预期应为关闭当前弹出的组件。\n为此提供“假页”容器组件，效果类似于 `popup` 弹出层，页面内存在该容器时，当用户进行返回操作，关闭该容器不关闭页面。返回操作包括三种情形，右滑手势、安卓物理返回键和调用 `navigateBack` 接口。",
    "attributes": [
      {
        "name": "bind:afterenter",
        "description": "Type: function => any\n进入后触发\nSince: 2.16.0"
      },
      {
        "name": "bind:afterleave",
        "description": "Type: function => any\n离开后触发\nSince: 2.16.0"
      },
      {
        "name": "bind:beforeenter",
        "description": "Type: function => any\n进入前触发\nSince: 2.16.0"
      },
      {
        "name": "bind:beforeleave",
        "description": "Type: function => any\n离开前触发\nSince: 2.16.0"
      },
      {
        "name": "bind:clickoverlay",
        "description": "Type: function => any\n点击遮罩层时触发\nSince: 2.16.0"
      },
      {
        "name": "bind:enter",
        "description": "Type: function => any\n进入中触发\nSince: 2.16.0"
      },
      {
        "name": "bind:leave",
        "description": "Type: function => any\n离开中触发\nSince: 2.16.0"
      },
      {
        "name": "close-on-slide-down",
        "description": "Type: boolean\n是否在下滑一段距离后关闭\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "custom-style",
        "description": "Type: string\n自定义弹出层样式\nSince: 2.16.0"
      },
      {
        "name": "duration",
        "description": "Type: number\n动画时长，单位毫秒\nDefault: 300\nSince: 2.16.0"
      },
      {
        "name": "overlay",
        "description": "Type: boolean\n是否显示遮罩层\nDefault: true\nSince: 2.16.0"
      },
      {
        "name": "overlay-style",
        "description": "Type: string\n自定义遮罩层样式\nSince: 2.16.0"
      },
      {
        "name": "position",
        "description": "Type: string\n弹出位置，可选值为 `top` `bottom` `right` `center`\nDefault: bottom\nSince: 2.16.0"
      },
      {
        "name": "round",
        "description": "Type: boolean\n是否显示圆角\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "show",
        "description": "Type: boolean\n是否显示容器组件\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "z-index",
        "description": "Type: number\nz-index 层级\nDefault: 100\nSince: 2.16.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/page-container.html"
      }
    ]
  },
  {
    "name": "page-meta",
    "description": "页面属性配置节点，用于指定页面的一些属性、监听页面事件。只能是页面内的第一个节点。可以配合 [navigation-bar](https://developers.weixin.qq.com/miniprogram/dev/component/navigation-bar.html) 组件一同使用。\n通过这个节点可以获得类似于调用 [`wx.setBackgroundTextStyle`](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundTextStyle.html) [`wx.setBackgroundColor`](https://developers.weixin.qq.com/miniprogram/dev/api/ui/background/wx.setBackgroundColor.html) 等接口调用的效果。",
    "attributes": [
      {
        "name": "background-color",
        "description": "Type: string\n窗口的背景色，必须为十六进制颜色值\nSince: 2.9.0"
      },
      {
        "name": "background-color-bottom",
        "description": "Type: string\n底部窗口的背景色，必须为十六进制颜色值，仅 iOS 支持\nSince: 2.9.0"
      },
      {
        "name": "background-color-top",
        "description": "Type: string\n顶部窗口的背景色，必须为十六进制颜色值，仅 iOS 支持\nSince: 2.9.0"
      },
      {
        "name": "background-text-style",
        "description": "Type: string\n下拉背景字体、loading 图的样式，仅支持 `dark` 和 `light`\nSince: 2.9.0"
      },
      {
        "name": "bindresize",
        "description": "Type: function => any\n页面尺寸变化时会触发 `resize` 事件， `event.detail = { size: { windowWidth, windowHeight } }`\nSince: 2.9.0"
      },
      {
        "name": "bindscroll",
        "description": "Type: function => any\n页面滚动时会触发 `scroll` 事件， `event.detail = { scrollTop }`\nSince: 2.9.0"
      },
      {
        "name": "bindscrolldone",
        "description": "Type: function => any\n如果通过改变 `scroll-top` 属性来使页面滚动，页面滚动结束后会触发 `scrolldone` 事件\nSince: 2.9.0"
      },
      {
        "name": "page-font-size",
        "description": "Type: string\n页面 page 的字体大小，可以设置为 `system` ，表示使用当前用户设置的微信字体大小\nDefault: \"\"\nSince: 2.11.0"
      },
      {
        "name": "page-orientation",
        "description": "Type: string\n页面的方向，可为 `auto` `portrait` 或 `landscape`\nDefault: \"\"\nSince: 2.12.0"
      },
      {
        "name": "page-style",
        "description": "Type: string\n页面根节点样式，页面根节点是所有页面节点的祖先节点，相当于 HTML 中的 body 节点\nDefault: \"\"\nSince: 2.9.0"
      },
      {
        "name": "root-background-color",
        "description": "Type: string\n页面内容的背景色，用于页面中的空白部分和页面大小变化 resize 动画期间的临时空闲区域\nSince: 2.12.1"
      },
      {
        "name": "root-font-size",
        "description": "Type: string\n页面的根字体大小，页面中的所有 rem 单位，将使用这个字体大小作为参考值，即 `1rem` 等于这个字体大小；自小程序版本 2.11.0 起，也可以设置为 `system`\nDefault: \"\"\nSince: 2.9.0"
      },
      {
        "name": "scroll-duration",
        "description": "Type: number\n滚动动画时长\nDefault: 300\nSince: 2.9.0"
      },
      {
        "name": "scroll-top",
        "description": "Type: string\n滚动位置，可以使用 px 或者 rpx 为单位，在被设置时，页面会滚动到对应位置\nDefault: \"\"\nSince: 2.9.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/page-meta.html"
      }
    ]
  },
  {
    "name": "share-element",
    "description": "共享元素。\n共享元素是一种动画形式，类似于 [flutter Hero](https://flutterchina.club/animations/hero-animations/)动画，表现为元素像是在页面间穿越一样。该组件需与 [page-container](https://developers.weixin.qq.com/miniprogram/dev/component/page-container.html) 组件结合使用。\n使用时需在当前页放置 `share-element` 组件，同时在 `page-container` 容器中放置对应的 `share-element` 组件，对应关系通过属性值 `key` 映射。当设置 `page-container` 显示时，`transform` 属性为 `true` 的共享元素会产生动画。当前页面容器退出时，会产生返回动画。\n使用 `worklet` 函数需要开启开发者工具 \"将 JS 编译成 ES5\" 或 \"编译 worklet 函数\" 选项。",
    "attributes": [
      {
        "name": "duration",
        "description": "Type: number\n动画时长，单位毫秒\nDefault: 300\nSince: 2.16.0"
      },
      {
        "name": "easing-function",
        "description": "Type: string\n`css`缓动函数\nDefault: ease-out\nSince: 2.16.0"
      },
      {
        "name": "key",
        "description": "Type: string\n映射标记，页面内唯一\nSince: 2.29.2"
      },
      {
        "name": "rect-tween-type",
        "description": "Type: string\nDefault: materialRectArc\nSince: 2.30.2",
        "values": [
          {
            "name": "materialRectArc",
            "description": "矩形对角动画"
          },
          {
            "name": "materialRectCenterArc",
            "description": "径向动画"
          },
          {
            "name": "linear"
          },
          {
            "name": "elasticIn"
          },
          {
            "name": "elasticOut"
          },
          {
            "name": "elasticInOut"
          },
          {
            "name": "bounceIn"
          },
          {
            "name": "bounceOut"
          },
          {
            "name": "bounceInOut"
          },
          {
            "name": "cubic-bezier(x1, y1, x2, y2",
            "description": ")"
          }
        ]
      },
      {
        "name": "shuttle-on-pop",
        "description": "Type: string\nDefault: to\nSince: 2.30.2",
        "values": [
          {
            "name": "from",
            "description": "pop 阶段采用源页面节点作为飞跃物"
          },
          {
            "name": "to",
            "description": "pop 阶段采用目标页面节点作为飞跃物"
          }
        ]
      },
      {
        "name": "shuttle-on-push",
        "description": "Type: string\nDefault: to\nSince: 2.30.2",
        "values": [
          {
            "name": "from",
            "description": "push 阶段采用源页面节点作为飞跃物"
          },
          {
            "name": "to",
            "description": "push 阶段采用目标页面节点作为飞跃物"
          }
        ]
      },
      {
        "name": "transform",
        "description": "Type: boolean\n是否进行动画\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "transition-on-gesture",
        "description": "Type: boolean\nDefault: false\nSince: 2.29.2"
      },
      {
        "name": "worklet:onframe",
        "description": "Type: function => any\nSince: 2.30.2"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/share-element.html"
      }
    ]
  }
]
