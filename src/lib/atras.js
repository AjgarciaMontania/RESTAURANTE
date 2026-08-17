import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as AppNativa } from "@capacitor/app";

/**
 * Botón físico "atrás" de Android, solo dentro del APK.
 *
 * Sin esto, cualquier toque en atrás cierra la aplicación y toca volver a
 * entrar. Ahora navega hacia la pantalla anterior y, cuando ya no hay a dónde
 * volver, pregunta antes de salir.
 *
 * En el navegador no hace nada: ahí el atrás del navegador ya funciona.
 */
export function useBotonAtras() {
  useEffect(() => {
    if (!Capacitor?.isNativePlatform?.()) return;

    let quitar;
    AppNativa.addListener("backButton", ({ canGoBack }) => {
      const enInicio = !location.hash || location.hash === "#/" || location.hash === "#";

      if (canGoBack && !enInicio) {
        history.back();
        return;
      }
      if (confirm("¿Salir de la aplicación?")) AppNativa.exitApp();
    }).then((h) => {
      quitar = h;
    });

    return () => quitar?.remove();
  }, []);
}
