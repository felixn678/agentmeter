import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { WidgetView } from "./components/widget-view";
import "./index.css";

// The widget window and the main window share this bundle; pick the view by label.
const isWidget = getCurrentWindow().label === "widget";
if (isWidget) document.documentElement.classList.add("widget");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isWidget ? <WidgetView /> : <App />}</React.StrictMode>,
);
