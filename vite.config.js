import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

/**
 * Sello de esta compilación. En GitHub usa el identificador del commit; en el
 * computador, la fecha. Sirve para que el TV sepa cuándo hay versión nueva.
 */
const VERSION = (process.env.GITHUB_SHA || "").slice(0, 7) || String(Date.now());

/** Publica /version.json junto al sitio, con el mismo sello. */
function selloDeVersion() {
  return {
    name: "sello-de-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ v: VERSION }),
      });
    },
  };
}

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
    selloDeVersion(),
  ],
  define: { __VERSION__: JSON.stringify(VERSION) },
  base: process.env.BASE ?? "/RESTAURANTE/",
  build: {
    target: ["es2015", "chrome61", "safari11"],
  },
});
