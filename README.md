# 🍽️ Restaurante — Menú diario, pedidos y cierre de caja

Aplicación web + APK Android para armar el menú del día, tomar pedidos tipo talonario
y verlos al instante en un TV de cocina.

**Stack:** React + Vite · Firebase Firestore (tiempo real) · GitHub Pages · Capacitor

---

## Pantallas

| Ruta | Para qué sirve |
|---|---|
| `#/` | **Menú del día** — Caldos, Proteínas, Adicional y Especiales en filas que se digitan a mano |
| `#/pedido` | **Talonario** — arma el pedido desde el menú del día y lo envía a cocina |
| `#/cocina` | **TV de cocina** — pantalla completa, pedidos entrantes en tiempo real |
| `#/caja` | **Cierre de caja** — total del día, almuerzos vendidos, historial y CSV |
| `#/ajustes` | **Precios base** y la dirección para el TV |

## Reglas de cobro

- **Caldo + proteína** → un solo almuerzo (precio normal o especial)
- **Solo caldo** → se cobra aparte
- **Solo proteína (seco)** → se cobra aparte
- **Adicional / Especial** → línea propia con su precio

Cada precio base tiene un interruptor **Fijo**: bloqueado al tomar el pedido, o editable
línea por línea. En Caldos y Proteínas el precio de la fila es opcional y, si se digita,
manda sobre el precio base.

## Desarrollo

```bash
npm install
npm run dev
```

## Publicar

Cada push a `main` despliega solo a GitHub Pages (`.github/workflows/deploy.yml`).

## APK Android

```bash
npm run build:apk     # compila con rutas relativas
npx cap sync android
cd android && ./gradlew assembleDebug
```
