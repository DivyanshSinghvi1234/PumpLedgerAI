import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { PreferencesProvider } from "@/lib/preferences";

import router from "./routes";
import { queryClient } from "./lib/queryClient";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" enableSystem>
      <PreferencesProvider>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </LanguageProvider>
      </PreferencesProvider>
    </ThemeProvider>
  </React.StrictMode>,
);