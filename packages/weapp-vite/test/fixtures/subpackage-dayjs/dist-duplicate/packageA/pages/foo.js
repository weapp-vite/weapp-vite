const require_rolldown_runtime = require("../../rolldown-runtime.js");
const require___weapp_shared___packageA_packageB_common = require("../__shared__/common.js");
var import_dayjs_min = /* @__PURE__ */ require_rolldown_runtime.__toESM(require___weapp_shared___packageA_packageB_common.require_dayjs_min(), 1);
var now = (0, import_dayjs_min.default)();
Page({
	data: {
		shared: require___weapp_shared___packageA_packageB_common.buildSharedMessage("packageA"),
		formattedNow: now.format("YYYY-MM-DD HH:mm:ss"),
		tomorrow: now.add(1, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageA foo loaded");
	}
});
