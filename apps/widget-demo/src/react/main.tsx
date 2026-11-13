import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./DemoApp.js";

// StrictMode runs every effect twice in development: a widget that doesn't
// clean up after itself would show up here as a doubled frame.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoApp site={(import.meta.env.VITE_BOOKING_SITE as string | undefined) ?? "http://demo.localhost:3000"} />
  </StrictMode>,
);
