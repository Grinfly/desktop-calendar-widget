# Cando 扩展开发：API 1

本底座保留旧版日期、节日和世界事件扩展，同时提供任务、事件、独立存储、面板和资源清理接口。无需增加运行时依赖。

## 创建与构建

复制 `extensions/sdk-example/`，修改目录名和 `manifest.json` 的 `id`，编写 `index.ts`：

```sh
npm run build:extension -- sdk-example
```

输出为 `dist-extensions/sdk-example.cando-ext`。在桌面版设置中安装。示例不会自动安装到用户程序。

通用构建命令要求目录名与 ID 相同，manifest 的入口为 `index.js`。依赖打包到单个 ES 模块；PNG、WebP、SVG 和 JPG 导入会内联。不要在入口中保留相对模块导入或运行时相对素材地址：目前入口通过 Blob URL 加载，不提供扩展资源服务器。CSS 可在面板容器内通过样式或插件自己的构建方案提供，避免修改主程序全局样式。

```json
{
  "id": "my-extension",
  "name": "我的扩展",
  "version": "1.0.0",
  "description": "扩展说明",
  "entry": "index.js",
  "apiVersion": 1,
  "capabilities": ["tasks:read", "tasks:write", "ui:panels"]
}
```

`version` 是插件自身版本；`apiVersion` 是宿主接口主版本。未声明 `apiVersion` 的包按旧版处理，旧函数无需改名。明确声明不受支持的版本或能力时，宿主显示不兼容状态，不执行入口代码。API 1 的新能力应保持向后兼容，破坏性接口变更需要增加 API 主版本并提供迁移适配。

旧版本 Cando 不理解此版本检查，API 1 插件需要用户先安装包含本底座升级的主程序。新底座对旧插件的兼容，不意味着新插件能够运行在旧主程序上。

## 初始化与生命周期

```ts
import type { ExtensionAPI } from "../../src/extensions/types";

export function init(api: ExtensionAPI) {
  const cancel = api.timers.setInterval(() => {
    // 更新内部缓存。
    api.invalidate();
  }, 60_000);

  const onVisibility = api.events.on("visibility:changed", ({ visible }) => {
    // 隐藏时减少动画或后台工作。
  });

  return () => { cancel(); onVisibility(); };
}
```

- `init(api)` 可以同步或异步，并可返回同步清理函数。导入与初始化合计超时 10 秒后，该插件停止，其他插件仍可加载。
- `dispose()` 是可选的同步停用钩子。优先使用 API 托管资源和 `onCleanup`。
- `api.signal` 在停用、失败或宿主卸载时中止，可传给 `fetch` 和原生 DOM 事件监听。
- `api.onCleanup(fn)` 注册资源清理，并返回可提前执行的幂等清理函数。
- `api.timers.setInterval(fn, ms)` 和 `setTimeout(fn, ms)` 返回取消函数。重复定时器最短 100ms；延时不能超过浏览器支持的范围。
- 使用原生定时器、声音、动画帧、事件监听或子框架时，插件必须主动注册清理。宿主无法自动回收任意全局副作用。
- API 1 插件启停无需重载页面。旧版插件启停会先保存待办再重载，以清除旧插件自行创建的全局定时器。
- 初始化期间可以读取任务和注册面板，读取的任务数据已经完成初次加载。

同步提供器、初始化、托管计时器和事件回调异常会停用对应插件并显示错误。面板 DOM 事件和插件自己创建的异步任务需要自行捕获错误。这里不提供独立进程、恶意代码隔离或死循环终止能力。

## 任务 API

读取需要 `tasks:read`，修改需要 `tasks:write`。任务以 `dateKey + id` 定位；`dateKey: null` 表示长期待办。

```ts
const all = api.tasks.list();
const today = api.tasks.list("2026-11-13");
const longTerm = api.tasks.list(null);
// 返回 [{ dateKey, task }] 的独立副本，修改副本不会修改宿主。

const id = api.tasks.create("2026-11-13", "整理项目资料");
api.tasks.update("2026-11-13", id, { done: true, note: "整理完成" });
api.tasks.remove("2026-11-13", id);
```

修改字段仅支持 `title`、`done`、`note`、`color`。使用 `color: ""` 清除颜色。图片引用和其他字段会保留，但本版不开放图片文件管理、任务跨日期移动、长期任务归档及月报写入。

命令由主程序统一更新和保存，插件不直接操作任务存储文件。命令返回表示已提交更新；React 提交后才可通过读取看到最新状态，依赖新状态时订阅 `tasks:changed`。同一事件中连续创建并更新可以按顺序提交。不存在的任务更新/删除按无操作处理。

## 事件与插件通信

```ts
const off = api.events.on("task:completed", ({ dateKey, task }) => {
  // 只在已存在任务由未完成变成完成时触发。
});
api.events.publish("focus-ended", { minutes: 25 });
const stop = api.events.on("extension:message", ({ extensionId, topic, data }) => {
  // 检查发送者、主题和数据格式，再执行联动。
});
```

| 事件 | 载荷 | 说明 |
|---|---|---|
| `tasks:changed` | `{ changes: [{ type, before?, after? }] }` | 已提交的创建、修改、删除；需要任务读取能力 |
| `task:completed` | `{ dateKey, task }` | `false → true`；需要任务读取能力 |
| `date:changed` | `{ dateKey }` | 本地日期改变，轮询或窗口可见时检查 |
| `visibility:changed` | `{ visible }` | WebView 文档可见性变化，并不等同于操作系统锁屏 |
| `extension:message` | `{ extensionId, topic, data }` | 插件发布的 JSON 消息，异步派发 |

初次加载和安装后重启不会回放任务完成事件。导入一条已完成的新任务不会发完成事件；已存在任务从未完成变成完成会发。撤销后再次完成会再次触发，因此奖励类插件需要自行记录领取规则。事件描述 React 提交的状态差异，不是持久化的操作审计日志；同一批次中完成后立即撤销，最终状态未改变就不触发。

事件载荷为独立副本。订阅返回取消函数，停用也会自动取消。消息必须带宿主注入的发送者 ID，不能通过消息接口伪造宿主任务事件。避免插件互相无限回复；宿主不限制所有插件业务循环。

## 独立存储

```ts
api.storage.set("progress", { level: 2, watered: true });
const progress = api.storage.get("progress");
api.storage.remove("progress");
```

按扩展 ID 分配 JSON 命名空间，后端为 WebView 的本地存储。读取不存在的键返回 `undefined`。写入非法 JSON、存储满或存储损坏时会抛错，插件应处理并向用户解释。

同 ID 升级和停用保留数据。当前卸载只移除扩展程序，保留该命名空间及启停偏好，重装后恢复。不要在这里保存大图片、音频或密钥；容量由 WebView 的存储配额决定。现有“待办备份”不包含插件数据。

需要迁移插件自身数据时，在命名空间中保存自己的 `schemaVersion`，由插件执行兼容迁移；`apiVersion` 不替代业务数据版本。

## 界面插槽

需要 `ui:panels`。`dashboard` 显示在日历/任务页底部；`settings` 显示在该扩展的设置项内。面板宿主不要求插件依赖 React。

```ts
api.ui.registerPanel({
  id: "progress",
  title: "今日进度",
  slot: "dashboard",
  mount(container) {
    const text = document.createElement("p");
    container.append(text);
    const render = () => {
      text.textContent = `共 ${api.tasks.list().length} 项待办`;
    };
    render();
    const off = api.events.on("tasks:changed", render);
    return () => off();
  },
});
```

面板会因切换页面而挂载/卸载，必须返回清理函数，释放面板专属订阅和 DOM 事件。插件自身的长期业务状态应放在模块或独立存储中。面板注册 ID 在该扩展内唯一，注册函数返回注销函数。

尽量复用 `var(--text)`、`var(--muted)`、`var(--border)` 以跟随主题。首页插槽限制高度并可滚动，插件需适配窄窗口。不要向宿主外部插入 DOM，也不要依赖宿主内部 class 或 React 对象。

## 兼容旧提供器

原有 `getDaySubLabel(date)`、`getDayBadge(date)`、`getDayAtmosphere(date)`、`getWorldEvent()` 均保留。日期信息按安装清单顺序取第一个有效值，宿主班休数据优先。世界事件取未过期且强度最高的有效事件。

事件类型和节日氛围仍限定为 `src/extensions/types.ts` 定义的枚举；本次没有增加任意特效渲染接口。修改内部缓存后调用 `api.invalidate()`，宿主会更新日期显示或世界事件。旧 `world-event-change` DOM 广播继续支持。

## 能力边界

能力声明限制通过 SDK 调用的服务，并帮助判断版本兼容性。插件当前仍在主页面执行，共享页面环境，**不构成安全沙箱**；只能安装可信扩展。网络请求仍使用浏览器 `fetch`，遵循 WebView 的跨域规则。系统通知、快捷键、文件访问、进程启动、本地模型等本版尚未作为通用服务开放。

本版不提供在线扩展商店、自动更新或宿主多版本并行适配。可手动安装同 ID 新包升级；正式分发前需用目标主程序验证。

## 验证

运行 JavaScript 测试需要 Node.js 22 或更高版本，以使用 Node 内置的模拟计时器。

```sh
npm run test:extensions
npm run build
npm run build:extension -- sdk-example
npm run build:ext:lunar
npm run build:ext:world-invasion
```

原生端在配置好的 Rust/MSVC 环境运行 `cargo test --offline --lib extensions::tests`。手工检查示例的任务创建、完成进度、设置保存、停用、重新启用和重启恢复，再验证旧版农历包。
