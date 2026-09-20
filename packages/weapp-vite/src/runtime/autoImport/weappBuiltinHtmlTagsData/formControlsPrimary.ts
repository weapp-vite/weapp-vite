// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_PRIMARY = [
  {
    "name": "button",
    "description": "按钮。",
    "attributes": [
      {
        "name": "app-parameter",
        "description": "Type: string"
      },
      {
        "name": "bindagreeprivacyauthorization",
        "description": "Type: function => any"
      },
      {
        "name": "bindchooseavatar",
        "description": "Type: function => any"
      },
      {
        "name": "bindcontact",
        "description": "Type: function => any"
      },
      {
        "name": "binderror",
        "description": "Type: function => any"
      },
      {
        "name": "bindgetphonenumber",
        "description": "Type: function => any"
      },
      {
        "name": "bindgetrealtimephonenumber",
        "description": "Type: function => any"
      },
      {
        "name": "bindgetuserinfo",
        "description": "Type: function => any"
      },
      {
        "name": "bindlaunchapp",
        "description": "Type: function => any"
      },
      {
        "name": "bindopensetting",
        "description": "Type: function => any"
      },
      {
        "name": "bindtap",
        "description": "Type: eventhandle"
      },
      {
        "name": "createliveactivity",
        "description": "Type: function => any"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "entrance-path",
        "description": "Type: string\nDefault: ''"
      },
      {
        "name": "form-type",
        "description": "Type: string",
        "values": [
          {
            "name": "submit",
            "description": "提交表单"
          },
          {
            "name": "reset",
            "description": "重置表单"
          },
          {
            "name": "submitToGroup",
            "description": "转发文本到聊天"
          }
        ]
      },
      {
        "name": "hover-class",
        "description": "Type: string\nDefault: button-hover"
      },
      {
        "name": "hover-start-time",
        "description": "Type: number\nDefault: 20"
      },
      {
        "name": "hover-stay-time",
        "description": "Type: number\nDefault: 70"
      },
      {
        "name": "hover-stop-propagation",
        "description": "Type: boolean\nDefault: false"
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
        "name": "loading",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "need-show-entrance",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "open-type",
        "description": "Type: string",
        "values": [
          {
            "name": "contact",
            "description": "打开客服会话，如果用户在会话中点击消息卡片后返回小程序，可以从 bindcontact 回调中获得具体信息，[具体说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/customer-message.html)。鸿蒙 OS 暂不支持"
          },
          {
            "name": "liveActivity",
            "description": "通过前端获取[新的一次性订阅消息下发机制](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-2.html)使用的 code"
          },
          {
            "name": "share",
            "description": "触发用户转发，使用前建议先阅读[使用指引](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html#%E4%BD%BF%E7%94%A8%E6%8C%87%E5%BC%95)"
          },
          {
            "name": "getPhoneNumber",
            "description": "手机号快速验证，向用户申请，并在用户同意后，快速填写和验证手机，[具体说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html) （*小程序插件中不能使用*）"
          },
          {
            "name": "getRealtimePhoneNumber",
            "description": "手机号实时验证，向用户申请，并在用户同意后，快速填写和实时验证手机号。[具体说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getRealtimePhoneNumber.html) （*小程序插件中不能使用*）"
          },
          {
            "name": "getUserInfo",
            "description": "获取用户信息，可以从bindgetuserinfo回调中获取到用户信息 （*小程序插件中不能使用*）"
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
            "description": "打开“意见反馈”页面，用户可提交反馈内容并上传[日志](https://developers.weixin.qq.com/miniprogram/dev/api/base/debug/wx.getLogManager.html)，开发者可以登录[小程序管理后台](https://mp.weixin.qq.com/)后进入左侧菜单“客服反馈”页面获取到反馈内容"
          },
          {
            "name": "chooseAvatar",
            "description": "获取用户头像，可以从bindchooseavatar回调中获取到头像信息"
          },
          {
            "name": "agreePrivacyAuthorization",
            "description": "用户同意隐私协议按钮。用户点击一次此按钮后，所有已声明过的隐私接口可以正常调用。可通过 bindagreeprivacyauthorization 监听用户同意隐私协议事件。隐私合规开发指南详情可见[《小程序隐私协议开发指南》](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)"
          }
        ]
      },
      {
        "name": "phone-number-no-quota-toast",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "plain",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "send-message-img",
        "description": "Type: string\nDefault: 截图"
      },
      {
        "name": "send-message-path",
        "description": "Type: string\nDefault: 当前分享路径"
      },
      {
        "name": "send-message-title",
        "description": "Type: string\nDefault: 当前标题"
      },
      {
        "name": "session-from",
        "description": "Type: string"
      },
      {
        "name": "show-message-card",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "size",
        "description": "Type: string\nDefault: default",
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
        "description": "Type: string\nDefault: default",
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
        "description": "Type: boolean\n当前是否选中，可用来设置默认选中\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "color",
        "description": "Type: string\ncheckbox的颜色，同css的color\nDefault: #09BB07\nSince: 1.0.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "value",
        "description": "Type: string\n[checkbox](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html)标识，选中时触发[checkbox-group](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox-group.html)的 change 事件，并携带 [checkbox](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html) 的 value\nSince: 1.0.0"
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
    "description": "多项选择器，内部由多个 checkbox 组成。",
    "attributes": [
      {
        "name": "bind:change",
        "description": "Type: eventhandle\n选中项发生改变时触发 change 事件\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/checkbox-group.html"
      }
    ]
  },
  {
    "name": "editor",
    "description": "富文本编辑器，可以对图片、文字进行编辑。\n编辑器导出内容支持带标签的 `html`和纯文本的 `text`，编辑器内部采用 `delta` 格式进行存储。\n通过`setContents`接口设置内容时，解析插入的 `html` 可能会由于一些非法标签导致解析错误，建议开发者在小程序内使用时通过 delta 进行插入。\n富文本组件内部引入了一些基本的样式使得内容可以正确的展示，开发时可以进行覆盖。需要注意的是，在其它组件或环境中使用富文本组件导出的html时，需要额外引入 [这段样式](data:application/zip;base64,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)，并维护`<ql-container><ql-editor></ql-editor></ql-container>`的结构。\n图片控件仅初始化时设置有效。\n相关 api：[EditorContext](https://developers.weixin.qq.com/miniprogram/dev/api/media/editor/EditorContext.html)",
    "attributes": [
      {
        "name": "bindblur",
        "description": "Type: function => any\n编辑器失去焦点时触发，detail = {html, text, delta}\nSince: 2.7.0"
      },
      {
        "name": "bindfocus",
        "description": "Type: function => any\n编辑器聚焦时触发，event.detail = {html, text, delta}\nSince: 2.7.0"
      },
      {
        "name": "bindinput",
        "description": "Type: function => any\n编辑器内容改变时触发，detail = {html, text, delta}\nSince: 2.7.0"
      },
      {
        "name": "bindready",
        "description": "Type: function => any\n编辑器初始化完成时触发\nSince: 2.7.0"
      },
      {
        "name": "bindstatuschange",
        "description": "Type: function => any\n通过 Context 方法改变编辑器内样式时触发，返回选区已设置的样式\nSince: 2.7.0"
      },
      {
        "name": "confirm-hold",
        "description": "Type: boolean\n点击键盘回车键时是否保持键盘不收起\nDefault: true\nSince: 3.7.11"
      },
      {
        "name": "enable-formats",
        "description": "Type: string[]\n编辑器允许的名单内的格式\nDefault: 所有格式\nSince: 3.2.2"
      },
      {
        "name": "enterkeyhint",
        "description": "Type: string\n定义虚拟键盘回车键的[操作标签](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Global_attributes/enterkeyhint)\nDefault: enter\nSince: 3.7.11"
      },
      {
        "name": "placeholder",
        "description": "Type: string\n提示信息\nSince: 2.7.0"
      },
      {
        "name": "read-only",
        "description": "Type: boolean\n设置编辑器为只读\nDefault: false\nSince: 2.7.0"
      },
      {
        "name": "show-img-resize",
        "description": "Type: boolean\n点击图片时显示修改尺寸控件\nDefault: false\nSince: 2.7.0"
      },
      {
        "name": "show-img-size",
        "description": "Type: boolean\n点击图片时显示图片大小控件\nDefault: false\nSince: 2.7.0"
      },
      {
        "name": "show-img-toolbar",
        "description": "Type: boolean\n点击图片时显示工具栏控件\nDefault: false\nSince: 2.7.0"
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
    "description": "表单。将组件内的用户输入的[switch](https://developers.weixin.qq.com/miniprogram/dev/component/switch.html) [input](https://developers.weixin.qq.com/miniprogram/dev/component/input.html) [checkbox](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html) [slider](https://developers.weixin.qq.com/miniprogram/dev/component/slider.html) [radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html) [picker](https://developers.weixin.qq.com/miniprogram/dev/component/picker.html) 提交。\n当点击 [form](https://developers.weixin.qq.com/miniprogram/dev/component/form.html) 表单中 form-type 为 submit 的 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件时，会将表单组件中的 value 值进行提交，需要在表单组件中加上 name 来作为 key。",
    "attributes": [
      {
        "name": "bindreset",
        "description": "Type: function => any\n表单重置时会触发 reset 事件\nSince: 1.0.0"
      },
      {
        "name": "bindsubmit",
        "description": "Type: function => any\n携带 form 中的数据触发 submit 事件，event.detail = {value : {'name': 'value'} , formId: ''}\nSince: 1.0.0"
      },
      {
        "name": "bindsubmitToGroup",
        "description": "Type: function => any\n用户发送文本到聊天后触发，但不代表最终发送成功\nSince: 3.7.8"
      },
      {
        "name": "name",
        "description": "Type: string\nSince: 1.6.7"
      },
      {
        "name": "report-submit",
        "description": "Type: boolean\n是否返回 formId 用于发送[模板消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/template-message.html)\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "report-submit-timeout",
        "description": "Type: number\n等待一段时间（毫秒数）以确认 formId 是否生效。如果未指定这个参数，formId 有很小的概率是无效的（如遇到网络失败的情况）。指定这个参数将可以检测 formId 是否有效，以这个参数的时间作为这项检测的超时时间。如果失败，将返回 requestFormId:fail 开头的 formId\nDefault: 0\nSince: 2.6.2"
      },
      {
        "name": "value",
        "description": "Type: any\nSince: 1.6.7"
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
    "description": "输入框。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制",
    "attributes": [
      {
        "name": "adjust-position",
        "description": "Type: boolean\nDefault: true"
      },
      {
        "name": "always-embed",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "bind:keyboardcompositionend",
        "description": "Type: function => any\n输入法输入结束时触发（仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:keyboardcompositionstart",
        "description": "Type: function => any\n输入法开始新的输入时触发 （仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:keyboardcompositionupdate",
        "description": "Type: function => any\n输入法输入字符时触发（仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:selectionchange",
        "description": "Type: function => any\n选区改变事件, {selectionStart, selectionEnd}\nSince: 3.2.0"
      },
      {
        "name": "bindblur",
        "description": "Type: function => any"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any"
      },
      {
        "name": "bindconfirm",
        "description": "Type: function => any"
      },
      {
        "name": "bindfocus",
        "description": "Type: function => any"
      },
      {
        "name": "bindinput",
        "description": "Type: function => any"
      },
      {
        "name": "bindkeyboardheightchange",
        "description": "Type: function => any"
      },
      {
        "name": "bindnicknamereview",
        "description": "Type: function => any"
      },
      {
        "name": "confirm-hold",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "confirm-type",
        "description": "Type: string\nDefault: done",
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
        "description": "Type: number"
      },
      {
        "name": "cursor-color",
        "description": "Type: string"
      },
      {
        "name": "cursor-spacing",
        "description": "Type: number\nDefault: 0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "focus",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "hold-keyboard",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "maxlength",
        "description": "Type: number\nDefault: 140"
      },
      {
        "name": "password",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "placeholder",
        "description": "Type: string"
      },
      {
        "name": "placeholder-class",
        "description": "Type: string\n指定 placeholder 的样式类\nDefault: input-placeholder\nSince: 1.0.0"
      },
      {
        "name": "placeholder-style",
        "description": "Type: string"
      },
      {
        "name": "safe-password-cert-path",
        "description": "Type: string"
      },
      {
        "name": "safe-password-custom-hash",
        "description": "Type: string"
      },
      {
        "name": "safe-password-length",
        "description": "Type: number"
      },
      {
        "name": "safe-password-nonce",
        "description": "Type: string"
      },
      {
        "name": "safe-password-salt",
        "description": "Type: string"
      },
      {
        "name": "safe-password-time-stamp",
        "description": "Type: number"
      },
      {
        "name": "selection-end",
        "description": "Type: number\nDefault: -1"
      },
      {
        "name": "selection-start",
        "description": "Type: number\nDefault: -1"
      },
      {
        "name": "type",
        "description": "Type: string\nDefault: text",
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
          },
          {
            "name": "safe-password",
            "description": "密码安全输入键盘 [指引](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/safe-password.html)。仅 Webview 支持。"
          },
          {
            "name": "nickname",
            "description": "昵称输入键盘。"
          }
        ]
      },
      {
        "name": "value",
        "description": "Type: string"
      },
      {
        "name": "worklet:onkeyboardheightchange",
        "description": "Type: function => any\n键盘高度变化时触发。event.detail = {height: height, pageBottomPadding: pageBottomPadding}； height: 键盘高度，pageBottomPadding: 页面上推高度\nSince: 3.2.4"
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
    "description": "设置 input / textarea 聚焦时键盘上方 cover-view / cover-image 工具栏视图",
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/keyboard-accessory.html"
      }
    ]
  },
  {
    "name": "label",
    "description": "用来改进表单组件的可用性。\n使用for属性找到对应的id，或者将控件放在该标签下，当点击时，就会触发对应的控件。\nfor优先级高于内部控件，内部有多个控件的时候默认触发第一个控件。\n目前可以绑定的控件有：[button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html), [checkbox](https://developers.weixin.qq.com/miniprogram/dev/component/checkbox.html), [radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html), [switch](https://developers.weixin.qq.com/miniprogram/dev/component/switch.html), [input](https://developers.weixin.qq.com/miniprogram/dev/component/input.html)。",
    "attributes": [
      {
        "name": "for",
        "description": "Type: string\n绑定控件的 id\nSince: 1.0.0"
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
