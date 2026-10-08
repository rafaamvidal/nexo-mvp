import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker
if ("serviceWorker" in navigator && !window.location.host.includes("localhost:5173-fake")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (import.meta.env.DEV) {
          console.log("PWA ServiceWorker registered with scope:", reg.scope);
        }
      })
      .catch((err) => {
        console.warn("PWA ServiceWorker registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

