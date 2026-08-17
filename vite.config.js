import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: nombre del repositorio en GitHub Pages.
// Para el APK de Capacitor se compila con BASE=./ (ver package.json)
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE ?? "/RESTAURANTE/",
});
