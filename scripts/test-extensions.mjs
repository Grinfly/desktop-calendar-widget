import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const bundled = await build({
  stdin: {
    contents: 'export * from "./src/extensions/runtime.ts"; export * from "./src/extensions/taskApi.ts";',
    resolveDir: root,
  },
  bundle: true, platform: "node", format: "esm", write: false,
});
const { ExtensionRuntime, compatibilityError, applyTaskCommand, listExtensionTasks, diffTasks } =
  await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const manifest = (id, extra = {}) => ({ id, name: id, version: "1.0.0", entry: "index.js", description: "", apiVersion: 1, ...extra });
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
const fixture = (modules, storage = memory()) => {
  let data = { tasks: {}, longTermTasks: [], monthSummaries: {}, settings: {} };
  const runtime = new ExtensionRuntime({
    listTasks: (dateKey) => listExtensionTasks(data, dateKey),
    writeTask: (command) => { data = applyTaskCommand(data, command); },
  }, storage, async ({ id }) => {
    const value = modules[id];
    if (value instanceof Error) throw value;
    return typeof value === "function" ? value() : value;
  }, () => {});
  return { runtime, storage, get data() { return data; } };
};

test("旧扩展无版本字段仍可加载，日期文字和班休仍生效", async (t) => {
  let initialized = 0;
  const { runtime } = fixture({ lunar: { init() { initialized++; }, getDaySubLabel: () => "初一", getDayBadge: () => "rest" } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("lunar", { apiVersion: undefined })]);
  assert.equal(initialized, 1);
  assert.equal(runtime.getDaySubLabel(new Date()), "初一");
  assert.equal(runtime.getDayBadge(new Date()), "rest");
  assert.equal(runtime.hasDayBadges, true);
});

test("未来 API 和未知能力在执行插件代码前拦截", async (t) => {
  let imported = 0;
  const { runtime } = fixture({ future: () => { imported++; return {}; }, unknown: () => { imported++; return {}; } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("future", { apiVersion: 2 }), manifest("unknown", { capabilities: ["future:service"] })]);
  assert.equal(imported, 0);
  assert.deepEqual(runtime.states.map((item) => item.status), ["incompatible", "incompatible"]);
  assert.ok(compatibilityError(manifest("bad", { capabilities: "tasks:read" })));
});

test("单个导入和初始化失败不影响其他插件", async (t) => {
  const { runtime } = fixture({ missing: new Error("文件损坏"), broken: { init() { throw new Error("初始化失败"); } }, good: {} });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("missing"), manifest("broken"), manifest("good")]);
  assert.deepEqual(runtime.states.map((item) => item.status), ["error", "error", "active"]);
});

test("日期提供器抛错后隔离并继续使用下一个插件", async (t) => {
  const { runtime } = fixture({ bad: { getDaySubLabel() { throw new Error("日期失败"); } }, good: { getDaySubLabel: () => "生日" } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("bad"), manifest("good")]);
  assert.equal(runtime.getDaySubLabel(new Date()), "生日");
  assert.equal(runtime.states[0].status, "error");
});

test("初始化超时结束加载，晚到的清理仍执行", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finish;
  let cleaned = 0;
  const { runtime } = fixture({ slow: { init: () => new Promise((resolve) => { finish = resolve; }) }, good: {} });
  t.after(() => runtime.dispose());
  const starting = runtime.start([manifest("slow"), manifest("good")]);
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(10_001);
  await starting;
  assert.equal(runtime.states[0].status, "error");
  assert.equal(runtime.states[1].status, "active");
  finish(() => { cleaned++; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleaned, 1);
});

test("导入期间卸载运行时，不会迟到初始化", async () => {
  let resolveModule;
  let initialized = false;
  const { runtime } = fixture({ slow: () => new Promise((resolve) => { resolveModule = resolve; }) });
  const starting = runtime.start([manifest("slow")]);
  runtime.dispose();
  await starting;
  resolveModule({ init() { initialized = true; } });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(initialized, false);
});

test("插件存储隔离且重启后保留，特殊键不会修改原型", async (t) => {
  const apis = {};
  const { runtime, storage } = fixture({ a: { init(api) { apis.a = api; } }, b: { init(api) { apis.b = api; } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("a"), manifest("b")]);
  apis.a.storage.set("progress", { count: 3 });
  apis.b.storage.set("progress", 8);
  apis.a.storage.set("__proto__", { safe: true });
  const read = apis.a.storage.get("progress");
  read.count = 100;
  assert.deepEqual(apis.a.storage.get("progress"), { count: 3 });
  assert.deepEqual(apis.a.storage.get("__proto__"), { safe: true });
  assert.equal(apis.b.storage.get("progress"), 8);
  runtime.dispose();
  const other = fixture({ a: { init(api) { apis.a = api; } } }, storage);
  t.after(() => other.runtime.dispose());
  await other.runtime.start([manifest("a")]);
  assert.deepEqual(apis.a.storage.get("progress"), { count: 3 });
  apis.a.storage.remove("progress");
  assert.equal(apis.a.storage.get("progress"), undefined);
  assert.throws(() => apis.a.storage.set("bad", undefined));
});

test("任务操作支持日期和长期待办，返回副本且保留已有备注图片", async (t) => {
  let api;
  const f = fixture({ tasks: { init(value) { api = value; } } });
  t.after(() => f.runtime.dispose());
  await f.runtime.start([manifest("tasks", { capabilities: ["tasks:read", "tasks:write"] })]);
  const id = api.tasks.create("2026-11-13", " 测试待办 ");
  const longId = api.tasks.create(null, "长期项目");
  f.data.tasks["2026-11-13"][0].noteImages = ["saved-image"];
  api.tasks.update("2026-11-13", id, { done: true, note: "进展" });
  api.tasks.update(null, longId, { title: "新标题" });
  const snapshot = api.tasks.list();
  snapshot[0].task.title = "不应改变原始任务";
  assert.equal(api.tasks.list("2026-11-13")[0].task.title, "测试待办");
  assert.deepEqual(api.tasks.list("2026-11-13")[0].task.noteImages, ["saved-image"]);
  assert.equal(api.tasks.list(null)[0].task.title, "新标题");
  api.tasks.remove("2026-11-13", id);
  api.tasks.remove(null, longId);
  assert.equal(api.tasks.list().length, 0);
});

test("任务入口拒绝非法日期、空标题及未知字段", async (t) => {
  let api;
  const { runtime } = fixture({ tasks: { init(value) { api = value; } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("tasks", { capabilities: ["tasks:read", "tasks:write"] })]);
  for (const day of ["2026-02-30", "2026-13-01", "bad", undefined]) assert.throws(() => api.tasks.create(day, "任务"));
  assert.throws(() => api.tasks.create(null, " "));
  assert.throws(() => api.tasks.update(null, "id", { id: "overwrite" }));
  assert.throws(() => api.tasks.update(null, "id", { done: "yes" }));
  assert.throws(() => api.tasks.list("2026-02-29"));
});

test("未声明任务或面板能力时拒绝调用", async (t) => {
  let api;
  const { runtime } = fixture({ empty: { init(value) { api = value; } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("empty")]);
  assert.throws(() => api.tasks.list(), /tasks:read/);
  assert.throws(() => api.tasks.create(null, "任务"), /tasks:write/);
  assert.throws(() => api.events.on("task:completed", () => {}), /tasks:read/);
  assert.throws(() => api.ui.registerPanel({}), /ui:panels/);
});

test("任务差异以日期和 ID 定位，重复渲染不会重复产生事件", () => {
  const item = { dateKey: "2026-11-13", task: { id: "a", title: "任务", done: false, note: "" } };
  assert.deepEqual(diffTasks([item], structuredClone([item])), []);
  const completed = { ...item, task: { ...item.task, done: true } };
  assert.equal(diffTasks([item], [completed])[0].type, "updated");
  const otherDate = { ...item, dateKey: "2026-11-14" };
  assert.deepEqual(diffTasks([item], [otherDate]).map((change) => change.type), ["created", "removed"]);
  assert.equal(diffTasks([], [completed])[0].type, "created");
});

test("停用清理订阅、计时器和信号，重新启用不重复订阅", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const apis = [];
  let ticks = 0;
  let calls = 0;
  let cleaned = 0;
  let disposed = 0;
  const { runtime } = fixture({ a: () => ({
    init(api) {
      apis.push(api);
      api.timers.setInterval(() => { ticks++; }, 100);
      api.events.on("date:changed", () => { calls++; });
      return () => { cleaned++; };
    },
    dispose() { disposed++; },
  }) });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("a")]);
  t.mock.timers.tick(100);
  runtime.emit("date:changed", { dateKey: "2026-11-14" });
  assert.equal(ticks, 1);
  assert.equal(calls, 1);
  await runtime.setEnabled("a", false);
  assert.equal(apis[0].signal.aborted, true);
  assert.throws(() => apis[0].storage.set("late", true), /已停用/);
  t.mock.timers.tick(500);
  runtime.emit("date:changed", { dateKey: "2026-11-15" });
  assert.equal(ticks, 1);
  assert.equal(calls, 1);
  assert.equal(cleaned, 1);
  assert.equal(disposed, 1);
  await runtime.setEnabled("a", true);
  runtime.emit("date:changed", { dateKey: "2026-11-16" });
  assert.equal(calls, 2);
  runtime.dispose();
  runtime.dispose();
  assert.equal(cleaned, 2);
  assert.equal(disposed, 2);
});

test("停用状态重启后保留且不会执行入口", async (t) => {
  const first = fixture({ a: {} });
  await first.runtime.start([manifest("a")]);
  await first.runtime.setEnabled("a", false);
  first.runtime.dispose();
  let imported = false;
  const second = fixture({ a: () => { imported = true; return {}; } }, first.storage);
  t.after(() => second.runtime.dispose());
  await second.runtime.start([manifest("a")]);
  assert.equal(imported, false);
  assert.equal(second.runtime.states[0].status, "disabled");
});

test("某个订阅者抛错不阻止其他订阅者，事件数据各自独立", async (t) => {
  let received;
  const { runtime } = fixture({
    bad: { init(api) { api.events.on("date:changed", (value) => { value.dateKey = "被修改"; throw new Error("订阅失败"); }); } },
    good: { init(api) { api.events.on("date:changed", (value) => { received = value.dateKey; }); } },
  });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("bad"), manifest("good")]);
  runtime.emit("date:changed", { dateKey: "2026-11-14" });
  assert.equal(received, "2026-11-14");
  assert.equal(runtime.states[0].status, "error");
});

test("面板挂载清理只执行一次，停用后移除注册", async (t) => {
  let cleaned = 0;
  let removed = 0;
  const { runtime } = fixture({ panel: { init(api) {
    api.ui.registerPanel({ id: "card", title: "卡片", slot: "dashboard", mount() { return () => { cleaned++; }; } });
  } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("panel", { capabilities: ["ui:panels"] })]);
  const unmount = runtime.mountPanel(runtime.panels[0], { replaceChildren() { removed++; } });
  await runtime.setEnabled("panel", false);
  unmount();
  assert.equal(cleaned, 1);
  assert.equal(removed, 1);
  assert.equal(runtime.panels.length, 0);
});

test("面板挂载错误不会传播到主程序", async (t) => {
  const { runtime } = fixture({ panel: { init(api) {
    api.ui.registerPanel({ id: "bad", title: "坏面板", slot: "settings", mount() { throw new Error("挂载失败"); } });
  } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("panel", { capabilities: ["ui:panels"] })]);
  runtime.mountPanel(runtime.panels[0], { replaceChildren() {} });
  assert.equal(runtime.states[0].status, "error");
});

test("插件消息带发送者，停用后不再派发排队消息", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let api;
  const messages = [];
  const { runtime } = fixture({ sender: { init(value) { api = value; } }, receiver: { init(value) {
    value.events.on("extension:message", (message) => messages.push(message));
  } } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("sender"), manifest("receiver")]);
  api.events.publish("focus-ended", { minutes: 25 });
  t.mock.timers.tick(1);
  assert.deepEqual(messages[0], { extensionId: "sender", topic: "focus-ended", data: { minutes: 25 } });
  api.events.publish("late", null);
  await runtime.setEnabled("sender", false);
  t.mock.timers.tick(1);
  assert.equal(messages.length, 1);
});

test("世界事件忽略失效和无效数据，选择有效最强事件", async (t) => {
  const event = (intensity, expiresAt = Date.now() + 60_000) => ({ type: "rain", intensity, label: "下雨", expiresAt });
  const { runtime } = fixture({ old: { getWorldEvent: () => event(1, 0) }, invalid: { getWorldEvent: () => event(NaN) }, mild: { getWorldEvent: () => event(0.2) }, strong: { getWorldEvent: () => event(0.8) } });
  t.after(() => runtime.dispose());
  await runtime.start([manifest("old"), manifest("invalid"), manifest("mild"), manifest("strong")]);
  assert.equal(runtime.getWorldEvent().intensity, 0.8);
  assert.equal(runtime.getWorldEvent(), runtime.getWorldEvent(), "未变化的事件不应反复触发动画");
  await runtime.setEnabled("strong", false);
  assert.equal(runtime.getWorldEvent().intensity, 0.2);
});
