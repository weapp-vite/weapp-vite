// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_TEMPLATES_AND_NAVIGATION = [
  {
    "name": "functional-page-navigator",
    "description": "这个组件从小程序基础库版本 [2.1.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html \"基础库 2.1.0 开始支持，低版本需做兼容处理。\") 开始支持。\n\n仅在插件的自定义组件中有效，用于跳转到插件功能页。",
    "attributes": [
      {
        "name": "args",
        "description": "Type: Object\n功能页参数，参数格式与具体功能页相关\nDefault: null\nSince: 2.1.0"
      },
      {
        "name": "bindfail",
        "description": "Type: function => any\n功能页返回，且操作失败时触发， detail 格式与具体功能页相关\nSince: 2.1.0"
      },
      {
        "name": "bindsuccess",
        "description": "Type: function => any\n功能页返回，且操作成功时触发， detail 格式与具体功能页相关\nSince: 2.1.0"
      },
      {
        "name": "name",
        "description": "Type: string\n要跳转到的功能页\n目前支持的功能页和name可选值: {loginAndGetUserInfo => \"[用户信息功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/user-info.html)\"; requestPayment => \"[支付功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/request-payment.html)\"}\nSince: 2.1.0"
      },
      {
        "name": "version",
        "description": "Type: string\n跳转到的小程序版本，有效值 `develop`（开发版），`trial`（体验版），`release`（正式版）；**线上版本必须设置为 `release`**\nDefault: release\nSince: 2.1.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/functional-page-navigator.html"
      }
    ]
  },
  {
    "name": "import",
    "description": "`import`有作用域的概念，即只会`import`目标文件中定义的`template`，而不会`import`目标文件`import`的`template`",
    "attributes": [
      {
        "name": "src",
        "description": "Type: string"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html"
      }
    ]
  },
  {
    "name": "include",
    "description": "`include`可以将目标文件除了 `<template />` `<wxs />` 外的整个代码引入，相当于是拷贝到`include`位置",
    "attributes": [
      {
        "name": "src",
        "description": "Type: string"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html#include"
      }
    ]
  },
  {
    "name": "navigator",
    "description": "页面链接。",
    "attributes": [
      {
        "name": "app-id",
        "description": "Type: string\n当target=\"miniProgram\"时有效，要打开的小程序 appId\nSince: 2.0.7"
      },
      {
        "name": "bindcomplete",
        "description": "Type: string\n当target=\"miniProgram\"时有效，跳转小程序完成\nSince: 2.0.7"
      },
      {
        "name": "bindfail",
        "description": "Type: string\n当target=\"miniProgram\"时有效，跳转小程序失败\nSince: 2.0.7"
      },
      {
        "name": "bindsuccess",
        "description": "Type: string\n当target=\"miniProgram\"时有效，跳转小程序成功\nSince: 2.0.7"
      },
      {
        "name": "delta",
        "description": "Type: number\n当 open-type 为 'navigateBack' 时有效，表示回退的层数"
      },
      {
        "name": "extra-data",
        "description": "Type: Object\n当target=\"miniProgram\"时有效，需要传递给目标小程序的数据，目标小程序可在 `App.onLaunch()`，`App.onShow()` 中获取到这份数据。[详情](https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/app.html)\nSince: 2.0.7"
      },
      {
        "name": "hover-class",
        "description": "Type: string\n指定点击时的样式类，当`hover-class=\"none\"`时，没有点击态效果\nDefault: navigator-hover"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\n按住后多久出现点击态，单位毫秒\nDefault: 50"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\n手指松开后点击态保留时间，单位毫秒\nDefault: 600"
      },
      {
        "name": "hover-stop-propagation",
        "description": "Type: boolean\n指定是否阻止本节点的祖先节点出现点击态\nDefault: false\nSince: 1.5.0"
      },
      {
        "name": "open-type",
        "description": "Type: string\n跳转方式\nDefault: navigate",
        "values": [
          {
            "name": "navigate",
            "description": "对应 `wx.navigateTo` 或 `wx.navigateToMiniProgram` 的功能"
          },
          {
            "name": "redirect",
            "description": "对应 `wx.redirectTo` 的功能"
          },
          {
            "name": "switchTab",
            "description": "对应 `wx.switchTab` 的功能"
          },
          {
            "name": "reLaunch",
            "description": "对应 `wx.reLaunch` 的功能"
          },
          {
            "name": "navigateBack",
            "description": "对应 `wx.navigateBack` 的功能"
          },
          {
            "name": "exit",
            "description": "退出小程序，target=\"miniProgram\"时生效"
          }
        ]
      },
      {
        "name": "path",
        "description": "Type: string\n当target=\"miniProgram\"时有效，打开的页面路径，如果为空则打开首页\nSince: 2.0.7"
      },
      {
        "name": "short-link",
        "description": "Type: string\n当target=\"miniProgram\"时有效，当传递该参数后，可以不传 app-id 和 path。链接可以通过【小程序菜单】->【复制链接】获取。\nSince: 2.18.1"
      },
      {
        "name": "target",
        "description": "Type: string\n在哪个目标上发生跳转，默认当前小程序，可选值self/miniProgram\nDefault: self\nSince: 2.0.7"
      },
      {
        "name": "url",
        "description": "Type: string\n当前小程序内的跳转链接"
      },
      {
        "name": "version",
        "description": "Type: string\n当target=\"miniProgram\"时有效，要打开的小程序版本，有效值 develop（开发版），trial（体验版），release（正式版），仅在当前小程序为开发版或体验版时此参数有效；如果当前小程序是正式版，则打开的小程序必定是正式版。\nDefault: release\nSince: 2.0.7"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/navigator.html"
      }
    ]
  },
  {
    "name": "slot",
    "description": "用于承载组件使用者提供的wxml结构",
    "attributes": [
      {
        "name": "name",
        "description": "Type: string"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/wxml-wxss.html#%E7%BB%84%E4%BB%B6-wxml-%E7%9A%84-slot"
      }
    ]
  },
  {
    "name": "template",
    "attributes": [
      {
        "name": "data",
        "description": "Type: any"
      },
      {
        "name": "is",
        "description": "Type: string"
      },
      {
        "name": "name",
        "description": "Type: string"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/template.html"
      }
    ]
  },
  {
    "name": "web-view",
    "description": "web-view 组件是一个可以用来承载网页的容器，会自动铺满整个小程序页面。**个人类型与海外类型的小程序暂不支持使用。**",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n网页加载失败的时候触发此事件。e.detail = { src }"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n网页加载成功时候触发此事件。e.detail = { src }"
      },
      {
        "name": "bindmessage",
        "description": "Type: function => any\n网页向小程序 postMessage 时，会在特定时机（小程序后退、组件销毁、分享）触发并收到消息。e.detail = { data }"
      },
      {
        "name": "src",
        "description": "Type: string\nwebview 指向网页的链接。可打开关联的公众号的文章，其它网页需登录[小程序管理后台](https://mp.weixin.qq.com/)配置业务域名。"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html"
      }
    ]
  }
]
