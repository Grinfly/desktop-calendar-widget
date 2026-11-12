import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TaskImagePreview } from "./components/TaskImagePreview";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {window.location.hash === "#image-preview" ? <TaskImagePreview /> : <App />}
  </React.StrictMode>,
);
