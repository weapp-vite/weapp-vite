// 本文件由 components.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_PRIMARY = [
  {
    "name": "button",
    "description": "按钮。",
    "attributes": [
      {
        "name": "app-parameter",
        "description": "Type: string\n打开 APP 时，向 APP 传递的参数\nSince: 1.9.5"
      },
      {
        "name": "bindcontact",
        "description": "Type: function => any\n客服消息回调\nSince: 1.5.0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n当使用开放能力时，发生错误的回调\nSince: 1.9.5"
      },
      {
        "name": "bindgetphonenumber",
        "description": "Type: function => any\n获取用户手机号回调\nSince: 1.2.0"
      },
      {
        "name": "bindgetuserinfo",
        "description": "Type: function => any\n用户点击该按钮时，会返回获取到的用户信息，回调的detail数据与[wx.getUserInfo](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html)返回的一致\nSince: 1.3.0"
      },
      {
        "name": "bindopensetting",
        "description": "Type: function => any\n在打开授权设置页后回调\nSince: 2.0.7"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "form-type",
        "description": "Type: string\n用于 `<form/>` 组件，点击分别会触发 `<form/>` 组件的 submit/reset 事件",
        "values": [
          {
            "name": "submit",
            "description": "提交表单"
          },
          {
            "name": "reset",
            "description": "重置表单"
          }
        ]
      },
      {
        "name": "hover-class",
        "description": "Type: string\n指定按钮按下去的样式类。当 `hover-class=\"none\"` 时，没有点击态效果\nDefault: button-hover"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\n按住后多久出现点击态，单位毫秒\nDefault: 20"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\n手指松开后点击态保留时间，单位毫秒\nDefault: 70"
      },
      {
        "name": "hover-stop-propagation",
        "description": "Type: boolean\n指定是否阻止本节点的祖先节点出现点击态\nDefault: false\nSince: 1.5.0"
      },
      {
        "name": "lang",
        "description": "Type: string\n指定返回用户信息的语言，zh_CN 简体中文，zh_TW 繁体中文，en 英文。\nDefault: en\nSince: 1.3.0"
      },
      {
        "name": "loading",
        "description": "Type: boolean\n名称前是否带 loading 图标\nDefault: false"
      },
      {
        "name": "open-type",
        "description": "Type: string\n微信开放能力\nSince: 1.1.0",
        "values": [
          {
            "name": "contact",
            "description": "打开客服会话"
          },
          {
            "name": "share",
            "description": "触发用户转发，使用前建议先阅读[使用指引](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html#使用指引)"
          },
          {
            "name": "getUserInfo",
            "description": "获取用户信息，可以从bindgetuserinfo回调中获取到用户信息"
          },
          {
            "name": "getPhoneNumber",
            "description": "获取用户手机号，可以从bindgetphonenumber回调中获取到用户信息，[具体说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html)"
          },
          {
            "name": "launchApp",
            "description": "打开APP，可以通过app-parameter属性设定向APP传的参数[具体说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/launchApp.html)"
          },
          {
            "name": "openSetting",
            "description": "打开授权设置页"
          },
          {
            "name": "feedback",
            "description": "打开“意见反馈”页面，用户可提交反馈内容并上传[日志](https://developers.weixin.qq.com/miniprogram/dev/api/debug/wx.getLogManager.html)，开发者可以登录[小程序管理后台](https://mp.weixin.qq.com/)后进入左侧菜单“客服反馈”页面获取到反馈内容"
          }
        ]
      },
      {
        "name": "plain",
        "description": "Type: boolean\n按钮是否镂空，背景色透明\nDefault: false"
      },
      {
        "name": "send-message-img",
        "description": "Type: string\n会话内消息卡片图片\nDefault: 截图\nSince: 1.5.0"
      },
      {
        "name": "send-message-path",
        "description": "Type: string\n会话内消息卡片点击跳转小程序路径\nDefault: 当前分享路径\nSince: 1.5.0"
      },
      {
        "name": "send-message-title",
        "description": "Type: string\n会话内消息卡片标题\nDefault: 当前标题\nSince: 1.5.0"
      },
      {
        "name": "session-from",
        "description": "Type: string\n会话来源\nSince: 1.4.0"
      },
      {
        "name": "show-message-card",
        "description": "Type: boolean\n显示会话内消息卡片\nDefault: false\nSince: 1.5.0"
      },
      {
        "name": "size",
        "description": "Type: string\n按钮的大小\nDefault: default",
        "values": [
          {
            "name": "default",
            "description": "默认大小"
          },
          {
            "name": "mini",
            "description": "小尺寸"
          }
        ]
      },
      {
        "name": "type",
        "description": "Type: string\n按钮的样式类型\nDefault: default",
        "values": [
          {
            "name": "primary",
            "description": "绿色"
          },
          {
            "name": "default",
            "description": "白色"
          },
          {
            "name": "warn",
            "description": "红色"
          }
        ]
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/button.html"
      }
    ]
  },
  {
    "name": "checkbox",
    "description": "多选项目。",
    "attributes": [
      {
        "name": "checked",
        "description": "Type: boolean\n当前是否选中，可用来设置默认选中\nDefault: false"
      },
      {
        "name": "color",
        "description": "Type: string\ncheckbox的颜色，同css的color"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "value",
        "description": "Type: string\n`<checkbox/>`标识，选中时触发`<checkbox-group/>`的 change 事件，并携带 `<checkbox/>` 的 value"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html"
      }
    ]
  },
  {
    "name": "checkbox-group",
    "description": "多项选择器，内部由多个`checkbox`组成。",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n`<checkbox-group/>`中选中项发生改变是触发 change 事件，detail = {value:\\[选中的checkbox的value的数组\\]}"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html"
      }
    ]
  },
  {
    "name": "editor",
    "description": "富文本编辑器，可以对图片、文字进行编辑。\n编辑器导出内容支持带标签的`html`和纯文本的`text`，编辑器内部采用`delta`格式进行存储。\n通过`setContents`接口设置内容时，解析插入的`html`可能会由于一些非法标签导致解析错误，建议开发者在小程序内使用时通过`delta`进行插入。\n富文本组件内部引入了一些基本的样式使得内容可以正确的展示，开发时可以进行覆盖。需要注意的是，在其它组件或环境中使用富文本组件导出的`html`时，需要额外引入[这段样式](https://developers.weixin.qq.com/miniprogram/dev/component/editor.html)，并维护`<ql-container><ql-editor></ql-editor></ql-container>`的结构。\n图片控件仅初始化时设置有效。\n编辑器内支持部分`HTML`标签和内联样式，不支持`class`和`id`\n不满足的标签会被忽略，`<div>`会被转行为`<p>`储存。\n内联样式仅能设置在行内元素或块级元素上，不能同时设置。例如`font-size`归类为行内元素属性，在`p`标签上设置是无效的。",
    "attributes": [
      {
        "name": "bindblur",
        "description": "Type: eventhandle\n编辑器失去焦点时触发，`detail = {html, text, delta}`"
      },
      {
        "name": "bindfocus",
        "description": "Type: eventhandle\n编辑器聚焦时触发，`event.detail = {html, text, delta}`"
      },
      {
        "name": "bindinput",
        "description": "Type: eventhandle\n编辑器内容改变时触发，`detail = {html, text, delta}`"
      },
      {
        "name": "bindready",
        "description": "Type: eventhandle\n编辑器初始化完成时触发"
      },
      {
        "name": "bindstatuschange",
        "description": "Type: eventhandle\n通过`Context`方法改变编辑器内样式时触发，返回选区已设置的样式"
      },
      {
        "name": "placeholder",
        "description": "Type: string\n提示信息"
      },
      {
        "name": "read-only",
        "description": "Type: boolean\n设置编辑器为只读\nDefault: false"
      },
      {
        "name": "show-img-resize",
        "description": "Type: boolean\n点击图片时显示修改尺寸控件\nDefault: false"
      },
      {
        "name": "show-img-size",
        "description": "Type: boolean\n点击图片时显示图片大小控件\nDefault: false"
      },
      {
        "name": "show-img-toolbar",
        "description": "Type: boolean\n点击图片时显示工具栏控件\nDefault: false"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/editor.html"
      }
    ]
  },
  {
    "name": "form",
    "description": "表单，将组件内的用户输入的`<switch/>` `<input/>` `<checkbox/>` `<slider/>` `<radio/>` `<picker/>` 提交。\n\n当点击 `<form/>` 表单中 formType 为 submit 的 `<button/>` 组件时，会将表单组件中的 value 值进行提交，需要在表单组件中加上 name 来作为 key。",
    "attributes": [
      {
        "name": "bindreset",
        "description": "Type: function => any\n表单重置时会触发 reset 事件"
      },
      {
        "name": "bindsubmit",
        "description": "Type: function => any\n携带 form 中的数据触发 submit 事件，event.detail = {value : {'name': 'value'} , formId: ''}"
      },
      {
        "name": "report-submit",
        "description": "Type: boolean\n是否返回 formId 用于发送[模板消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/template-message.html)"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/form.html"
      }
    ]
  },
  {
    "name": "input",
    "description": "输入框。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。",
    "attributes": [
      {
        "name": "adjust-position",
        "description": "Type: boolean\n键盘弹起时，是否自动上推页面\nDefault: true\nSince: 1.9.90"
      },
      {
        "name": "always-embed",
        "description": "Type: boolean\n强制 input 处于同层状态，默认 focus 时 input 会切到非同层状态 (仅在 iOS 下生效)\nDefault: false\nSince: 2.10.4"
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\n(即将废弃，请直接使用 focus )自动聚焦，拉起键盘\nDefault: false"
      },
      {
        "name": "bindblur",
        "description": "Type: function => any\n输入框失去焦点时触发，event.detail = {value: value}"
      },
      {
        "name": "bindconfirm",
        "description": "Type: function => any\n点击完成按钮时触发，event.detail = {value: value}"
      },
      {
        "name": "bindfocus",
        "description": "Type: function => any\n输入框聚焦时触发，event.detail = { value, height }，height 为键盘高度，在基础库 1.9.90 起支持"
      },
      {
        "name": "bindinput",
        "description": "Type: function => any\n键盘输入时触发，event.detail = {value, cursor, keyCode}，keyCode 为键值，2.1.0 起支持，处理函数可以直接 return 一个字符串，将替换输入框的内容。"
      },
      {
        "name": "bindkeyboardheightchange",
        "description": "Type: function => any\n键盘高度发生变化的时候触发此事件，event.detail = {height: height, duration: duration}\nSince: 2.7.0"
      },
      {
        "name": "confirm-hold",
        "description": "Type: boolean\n点击键盘右下角按钮时是否保持键盘不收起\nDefault: false\nSince: 1.1.0"
      },
      {
        "name": "confirm-type",
        "description": "Type: string\n设置键盘右下角按钮的文字，仅在type='text'时生效\nDefault: done\nSince: 1.1.0",
        "values": [
          {
            "name": "send",
            "description": "右下角按钮为“发送”"
          },
          {
            "name": "search",
            "description": "右下角按钮为“搜索”"
          },
          {
            "name": "next",
            "description": "右下角按钮为“下一个”"
          },
          {
            "name": "go",
            "description": "右下角按钮为“前往”"
          },
          {
            "name": "done",
            "description": "右下角按钮为“完成”"
          }
        ]
      },
      {
        "name": "cursor",
        "description": "Type: number\n指定focus时的光标位置\nSince: 1.5.0"
      },
      {
        "name": "cursor-spacing",
        "description": "Type: number\n指定光标与键盘的距离，单位 px 。取 input 距离底部的距离和 cursor-spacing 指定的距离的最小值作为光标与键盘的距离\nDefault: 0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false"
      },
      {
        "name": "focus",
        "description": "Type: boolean\n获取焦点\nDefault: false"
      },
      {
        "name": "hold-keyboard",
        "description": "Type: boolean\nfocus时，点击页面的时候不收起键盘\nDefault: false\nSince: 2.8.2"
      },
      {
        "name": "maxlength",
        "description": "Type: number\n最大输入长度，设置为 -1 的时候不限制最大长度\nDefault: 140"
      },
      {
        "name": "password",
        "description": "Type: boolean\n是否是密码类型\nDefault: false"
      },
      {
        "name": "placeholder",
        "description": "Type: string\n输入框为空时占位符"
      },
      {
        "name": "placeholder-class",
        "description": "Type: string\n指定 placeholder 的样式类\nDefault: input-placeholder"
      },
      {
        "name": "placeholder-style",
        "description": "Type: string\n指定 placeholder 的样式"
      },
      {
        "name": "safe-password-cert-path",
        "description": "Type: string\n安全键盘加密公钥的路径，只支持包内路径\nSince: 2.18.0"
      },
      {
        "name": "safe-password-custom-hash",
        "description": "Type: string\n安全键盘计算hash的算法表达式，如`md5(sha1('foo' + sha256(sm3(password + 'bar'))))`\nSince: 2.18.0"
      },
      {
        "name": "safe-password-length",
        "description": "Type: number\n安全键盘输入密码长度\nSince: 2.18.0"
      },
      {
        "name": "safe-password-nonce",
        "description": "Type: string\n安全键盘加密盐值\nSince: 2.18.0"
      },
      {
        "name": "safe-password-salt",
        "description": "Type: string\n安全键盘计算hash盐值，若指定`custom-hash`则无效\nSince: 2.18.0"
      },
      {
        "name": "safe-password-time-stamp",
        "description": "Type: number\n安全键盘加密时间戳\nSince: 2.18.0"
      },
      {
        "name": "selection-end",
        "description": "Type: number\n光标结束位置，自动聚集时有效，需与selection-start搭配使用\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "selection-start",
        "description": "Type: number\n光标起始位置，自动聚集时有效，需与selection-end搭配使用\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "type",
        "description": "Type: string\ninput 的类型\nDefault: text",
        "values": [
          {
            "name": "text",
            "description": "文本输入键盘"
          },
          {
            "name": "number",
            "description": "数字输入键盘"
          },
          {
            "name": "idcard",
            "description": "身份证输入键盘"
          },
          {
            "name": "digit",
            "description": "带小数点的数字键盘"
          }
        ]
      },
      {
        "name": "value",
        "description": "Type: string\n输入框的初始内容"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/input.html"
      }
    ]
  },
  {
    "name": "keyboard-accessory",
    "description": "设置 `input` / `textarea` 聚焦时键盘上方 `cover-view` / `cover-image` 工具栏视图",
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/keyboard-accessory.html"
      }
    ]
  },
  {
    "name": "label",
    "description": "用来改进表单组件的可用性，使用`for`属性找到对应的`id`，或者将控件放在该标签下，当点击时，就会触发对应的控件。\n\n`for`优先级高于内部控件，内部有多个控件的时候默认触发第一个控件。\n\n目前可以绑定的控件有：`<button/>`, `<checkbox/>`, `<radio/>`, `<switch/>`。",
    "attributes": [
      {
        "name": "for",
        "description": "Type: string\n绑定控件的 id"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/label.html"
      }
    ]
  }
]
