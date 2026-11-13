import type { ExtensionAPI } from "../../src/extensions/types";

export function init(api: ExtensionAPI) {
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  api.ui.registerPanel({
    id: "today",
    title: "今日进度",
    slot: "dashboard",
    mount(container) {
      const progress = document.createElement("p");
      progress.style.margin = "0 0 6px";
      const button = document.createElement("button");
      button.textContent = "添加一条示例待办";
      button.onclick = () => api.tasks.create(today(), "试试 Cando 插件");
      container.append(progress, button);
      const render = () => {
        const tasks = api.tasks.list(today());
        const greeting = api.storage.get<string>("greeting") ?? "今天也可以慢慢来";
        progress.textContent = `${greeting} · ${tasks.filter(({ task }) => task.done).length}/${tasks.length} 已完成`;
      };
      render();
      const offTasks = api.events.on("tasks:changed", render);
      const offDate = api.events.on("date:changed", render);
      const offMessage = api.events.on("extension:message", (event) => {
        if (event.extensionId === api.extensionId && event.topic === "greeting-changed") render();
      });
      return () => { offTasks(); offDate(); offMessage(); button.onclick = null; };
    },
  });

  api.ui.registerPanel({
    id: "preferences",
    title: "卡片问候语",
    slot: "settings",
    mount(container) {
      const label = document.createElement("label");
      label.textContent = "问候语 ";
      const input = document.createElement("input");
      input.type = "text";
      input.value = api.storage.get<string>("greeting") ?? "今天也可以慢慢来";
      input.onchange = () => {
        api.storage.set("greeting", input.value);
        api.events.publish("greeting-changed", input.value);
      };
      label.append(input);
      container.append(label);
      return () => { input.onchange = null; };
    },
  });
}
