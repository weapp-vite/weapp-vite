var DAY_MS = 1440 * 60 * 1e3;
function normalizeInput(input) {
	if (input instanceof Date) return new Date(input.getTime());
	if (typeof input === "number") return new Date(input);
	if (typeof input === "string") {
		const parsed = new Date(input);
		if (Number.isNaN(parsed.getTime())) return /* @__PURE__ */ new Date();
		return parsed;
	}
	return /* @__PURE__ */ new Date();
}
function formatDate(date, pattern) {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hour = `${date.getHours()}`.padStart(2, "0");
	const minute = `${date.getMinutes()}`.padStart(2, "0");
	const second = `${date.getSeconds()}`.padStart(2, "0");
	switch (pattern) {
		case "YYYY-MM-DD": return `${year}-${month}-${day}`;
		case "YYYY-MM-DD HH:mm:ss":
		default: return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
	}
}
function wrap(date) {
	return {
		add(amount = 0, unit = "day") {
			const normalized = unit === "day" || unit === "days" ? amount * DAY_MS : 0;
			return dayjs(new Date(date.getTime() + normalized));
		},
		format(pattern = "YYYY-MM-DD HH:mm:ss") {
			return formatDate(date, pattern);
		},
		toDate() {
			return new Date(date.getTime());
		},
		valueOf() {
			return date.getTime();
		}
	};
}
function dayjs(input) {
	return wrap(normalizeInput(input));
}
var dayjs_default = dayjs;
function buildSharedMessage(origin) {
	return `[shared:${origin}] ${dayjs_default().format("YYYY-MM-DD HH:mm:ss")}`;
}
Object.defineProperty(exports, "buildSharedMessage", {
	enumerable: true,
	get: function() {
		return buildSharedMessage;
	}
});
Object.defineProperty(exports, "dayjs_default", {
	enumerable: true,
	get: function() {
		return dayjs_default;
	}
});
