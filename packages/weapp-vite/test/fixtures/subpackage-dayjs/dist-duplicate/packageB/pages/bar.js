const require_rolldown_runtime = require("../../rolldown-runtime.js");
const require___weapp_shared___packageA_packageB_common = require("../__shared__/common.js");
var import_dayjs_min = /* @__PURE__ */ require_rolldown_runtime.__toESM(require___weapp_shared___packageA_packageB_common.require_dayjs_min(), 1);
var baseline = (0, import_dayjs_min.default)("2000-01-01T00:00:00");
Page({
	data: {
		shared: require___weapp_shared___packageA_packageB_common.buildSharedMessage("packageB"),
		formattedBaseline: baseline.format("YYYY-MM-DD"),
		plusSevenDays: baseline.add(7, "day").format("YYYY-MM-DD")
	},
	onLoad() {
		console.log("packageB bar loaded");
	}
});
