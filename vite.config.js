import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

// base: nombre del repositorio en GitHub Pages.
// Para el APK de Capacitor se compila con BASE=./ (ver package.json)
export default defineConfig({
  plugins: [
    react(),
    // Los TV Box y Smart TV suelen traer un WebView muy viejo. Este plugin
    // genera además una versión compatible con esos navegadores, para que la
    // pantalla de cocina no quede en blanco.
    legacy({
      targets: ["chrome >= 61", "safari >= 11", "android >= 6"],
      modernPolyfills: true,
    }),
  ],
  base: process.env.BASE ?? "/RESTAURANTE/",
  build: {
    target: ["es2015", "chrome61", "safari11"],
  },
});
