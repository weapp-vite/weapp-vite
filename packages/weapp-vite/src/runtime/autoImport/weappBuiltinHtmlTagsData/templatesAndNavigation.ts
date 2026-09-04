// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_TEMPLATES_AND_NAVIGATION = [
  {
    "name": "functional-page-navigator",
    "description": "仅在插件中有效，用于跳转到插件功能页。",
    "attributes": [
      {
        "name": "args",
        "description": "Type: Object"
      },
      {
        "name": "bindcancel",
        "description": "Type: function => any"
      },
      {
        "name": "bindfail",
        "description": "Type: function => any"
      },
      {
        "name": "bindsuccess",
        "description": "Type: function => any"
      },
      {
        "name": "name",
        "description": "Type: string",
        "values": [
          {
            "name": "loginAndGetUserInfo",
            "description": "[用户信息功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/user-info.html)"
          },
          {
            "name": "requestPayment",
            "description": "[支付功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/request-payment.html)"
          },
          {
            "name": "chooseAddress",
            "description": "[收货地址功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/choose-address.html)"
          },
          {
            "name": "chooseInvoice",
            "description": "[获取发票功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/choose-invoice.html)"
          },
          {
            "name": "chooseInvoiceTitle",
            "description": "[获取发票抬头功能页](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/functional-pages/choose-invoice-title.html)"
          }
        ]
      },
      {
        "name": "version",
        "description": "Type: string\nDefault: release",
        "values": [
          {
            "name": "develop",
            "description": "开发版"
          },
          {
            "name": "trial",
            "description": "体验版"
          },
          {
            "name": "release",
            "description": "正式版"
          }
        ]
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
    "description": "页面链接。\nnavigator 在 Skyline 下视为文本节点，只能嵌套文本节点（如 text），不能嵌套 view、button 等普通节点，如 <button> <navigator>foo</navigator> </button>\n新增 span 组件用于内联文本和图片，如 <span> <image> </image> <navigator>bar</navigator> </span>",
    "attributes": [
      {
        "name": "app-id",
        "description": "Type: string"
      },
      {
        "name": "bindcomplete",
        "description": "Type: string"
      },
      {
        "name": "bindfail",
        "description": "Type: string"
      },
      {
        "name": "bindsuccess",
        "description": "Type: string"
      },
      {
        "name": "delta",
        "description": "Type: number\nDefault: 1"
      },
      {
        "name": "extra-data",
        "description": "Type: Object"
      },
      {
        "name": "hover-class",
        "description": "Type: string\nDefault: navigator-hover"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\nDefault: 50"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\nDefault: 600"
      },
      {
        "name": "hover-stop-propagation",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "open-type",
        "description": "Type: string\nDefault: navigate",
        "values": [
          {
            "name": "navigate",
            "description": "对应 [wx.navigateTo](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html) 或 [wx.navigateToMiniProgram](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateToMiniProgram.html) 的功能"
          },
          {
            "name": "redirect",
            "description": "对应 [wx.redirectTo](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.redirectTo.html) 的功能"
          },
          {
            "name": "switchTab",
            "description": "对应 [wx.switchTab](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.switchTab.html) 的功能"
          },
          {
            "name": "reLaunch",
            "description": "对应 [wx.reLaunch](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.reLaunch.html) 的功能"
          },
          {
            "name": "navigateBack",
            "description": "对应 [wx.navigateBack](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html) 或 [wx.navigateBackMiniProgram](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateBackMiniProgram.html) （基础库 2.24.4 版本支持）的功能"
          },
          {
            "name": "exit",
            "description": "退出小程序，`target=\"miniProgram\"`时生效"
          }
        ]
      },
      {
        "name": "path",
        "description": "Type: string"
      },
      {
        "name": "short-link",
        "description": "Type: string"
      },
      {
        "name": "target",
        "description": "Type: string\nDefault: self",
        "values": [
          {
            "name": "self",
            "description": "当前小程序"
          },
          {
            "name": "miniProgram",
            "description": "其它小程序"
          }
        ]
      },
      {
        "name": "url",
        "description": "Type: string"
      },
      {
        "name": "version",
        "description": "Type: string\nDefault: release",
        "values": [
          {
            "name": "develop",
            "description": "开发版"
          },
          {
            "name": "trial",
            "description": "体验版"
          },
          {
            "name": "release",
            "description": "正式版，仅在当前小程序为开发版或体验版时此参数有效；如果当前小程序是正式版，则打开的小程序必定是正式版。"
          }
        ]
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
    "description": "承载网页的容器。会自动铺满整个小程序页面，个人类型的小程序暂不支持使用。\n客户端 6.7.2 版本开始，[`navigationStyle: custom`](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html) 对 [web-view](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html) 组件无效",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any\n网页加载失败的时候触发此事件。e.detail = { url, fullUrl }，其中 fullUrl 为加载失败时的完整 url\nSince: 1.6.4"
      },
      {
        "name": "bindload",
        "description": "Type: function => any\n网页加载成功时候触发此事件。e.detail = { src }\nSince: 1.6.4"
      },
      {
        "name": "bindmessage",
        "description": "Type: function => any\n网页向小程序 postMessage 时，会在以下特定时机触发并收到消息：小程序后退、组件销毁、分享、复制链接（[2.31.1](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)）。e.detail = { data }，data是多次 postMessage 的参数组成的数组。\nSince: 1.6.4"
      },
      {
        "name": "src",
        "description": "Type: string\nwebview 指向网页的链接。可打开关联的公众号的文章，其它网页需登录[小程序管理后台](https://mp.weixin.qq.com/)配置业务域名。\nSince: 1.6.4"
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
