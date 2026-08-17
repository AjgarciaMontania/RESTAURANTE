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

## Seguridad

1. Firebase Console -> **Authentication** -> Sign-in method -> habilitar **Anónimo**
2. Firebase Console -> **Firestore Database** -> Reglas -> pegar `firestore.rules` -> Publicar
3. En la app, pestaña **Ajustes** -> **PIN de acceso** -> poner 4 digitos

El PIN se guarda como hash SHA-256, nunca en texto plano. Cada dispositivo lo
digita una sola vez y queda recordado.

## Desarrollo

```bash
npm install
npm run dev
```

## Publicar

Cada push a `main` despliega solo a GitHub Pages (`.github/workflows/deploy.yml`).

## APK Android

El APK es una ventana sobre el sitio publicado (`server.url` en
`capacitor.config.json`), así que **se actualiza solo** con cada despliegue y no
hay que reinstalarlo. Si no hay conexión muestra `public/error.html`.

Se compila solo en GitHub Actions (`.github/workflows/apk.yml`) y queda como
artifact. Para compilarlo a mano:

```bash
npm run build:apk
npx cap sync android
cd android && ./gradlew assembleRelease
```

La firma es fija (`android/app/restaurante.keystore`), así cada APK nuevo se
instala encima del anterior sin desinstalar.
