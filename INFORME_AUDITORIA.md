# Informe de Auditoría — App de Legalizaciones COLSEIN S.A.S.

> **Fecha:** 09/07/2026
> **Alcance:** Auditoría integral (ciberseguridad, funcionalidad y diseño/UX) del backend (Node/Express/Sequelize), el frontend (React/Vite) y la configuración de despliegue.
> **Ejecución:** Siguiendo el prompt `PROMPT_AUDITORIA_APP.md`. Las correcciones seguras se aplicaron directamente en el código de la rama de trabajo; los cambios que alteran reglas de negocio o requieren decisión quedan documentados y trasladados a `PROMPT_CORRECCIONES.md`.

---

## A. Resumen ejecutivo

La aplicación **ya había pasado por una corrección de seguridad previa** (ver `AUDITORIA_INTERNA_COLSEIN.md`) que cerró los hallazgos más graves de backend: control de acceso por objeto (IDOR) en reportes y legalizaciones, lista blanca de campos contra manipulación de montos, límite de intentos de login, filtro de archivos subidos, arranque bloqueado sin `JWT_SECRET` seguro y validación de montos. Esta auditoría verificó que esos controles siguen en su lugar y **encontró un hallazgo de seguridad todavía activo y de impacto alto**: la pantalla de inicio de sesión mostraba credenciales reales y funcionales (incluida la de administrador, `admin2026`) a **cualquier** persona que abriera la app en producción. Ese hallazgo ya quedó **corregido**. Además se restringió un endpoint de diagnóstico que filtraba rutas del servidor y se redujeron las vulnerabilidades de dependencias sin romper compatibilidad. Los riesgos que restan son de tipo **decisión de negocio** (buzón de correo IMAP compartido) o **actualizaciones mayores de librerías** que requieren pruebas dedicadas. **Veredicto:** con las correcciones de esta auditoría, la app queda en un estado razonablemente seguro para operar, condicionado a los dos pasos operativos obligatorios en Railway (rotar `JWT_SECRET` y cambiar las contraseñas de producción).

---

## B. Tabla de hallazgos

| ID | Severidad | Categoría | Descripción | Archivo(s):línea | Estado | Commit |
|---|---|---|---|---|---|---|
| SEC-01 | 🔴 Alta | Seguridad | La pantalla de login mostraba cuentas de prueba con contraseñas reales y funcionales (`meza2026`, `ramirez2026`, `admin2026`) a cualquier visitante en producción; un clic autocompletaba y permitía entrar como administrador. | `frontend/src/pages/LoginPage.jsx:80-93` | ✅ Corregido | (esta rama) |
| SEC-02 | 🟡 Media | Seguridad | El endpoint de diagnóstico `GET /api/reports/diagnose-images` devolvía rutas absolutas del servidor (`cwd`, rutas resueltas del disco) a cualquier usuario autenticado. | `backend/src/routes/reports.js:183` | ✅ Corregido | (esta rama) |
| SEC-03 | 🟡 Media | Seguridad | Dependencia frontend `form-data` con vulnerabilidad alta (inyección CRLF) y otra menor, corregibles sin cambios mayores. | `frontend/package-lock.json` | ✅ Corregido | (esta rama) |
| DOC-01 | 🟢 Baja | Funcional/Doc | `CLAUDE.md` afirmaba que el OCR usa "Claude Vision API" cuando el código usa Tesseract.js local con preprocesado `sharp`. | `CLAUDE.md:73` | ✅ Corregido | (esta rama) |
| SEC-04 | 🟠 Alta | Seguridad | **Buzón IMAP compartido:** `GET /api/email/search`, `GET /api/email/attachment/:uid/:filename` y `POST /api/email/match` permiten a cualquier usuario con sesión buscar y descargar correos/adjuntos de **todo** el buzón corporativo (cambiando el `uid`). No hay separación por empleado. | `backend/src/routes/email.js:24,137,169` | ⚠️ Requiere decisión | — |
| SEC-05 | 🟡 Media | Seguridad | Dependencias con vulnerabilidades que **solo se resuelven con actualizaciones mayores**: backend `imap`/`utf7`/`uuid` (vía sequelize/exceljs); frontend `esbuild`/`vite`/`vite-plugin-pwa` (afecta al servidor de desarrollo, no al build de producción). | `backend/package.json`, `frontend/package.json` | ⚠️ Requiere decisión | — |
| SEC-06 | 🟢 Baja | Seguridad | `GET /api/config` devuelve todas las claves de `system_config` a cualquier usuario autenticado. Hoy solo contiene tarifas (necesarias en el cliente), pero cualquier clave sensible que se agregue quedaría expuesta. | `backend/src/routes/config.js:7` | ⚠️ Requiere decisión | — |
| FUN-01 | 🟡 Media | Funcional | No hay pruebas automatizadas (unitarias ni de integración). Los controles críticos (IDOR, flujo de aprobación jerárquico, bloqueo tras envío, cálculo de totales) dependen de verificación manual. | (todo el backend) | ⚠️ Pendiente | — |
| OPS-01 | 🔴 Crítica | Seguridad/Operación | Las contraseñas de producción (`admin2026`, etc.) siguen publicadas en las semillas del repo y deben rotarse; `JWT_SECRET` debe ser una clave fuerte en Railway. **No son código: son pasos operativos.** | `backend/seeds/20260407000001-demo-data.js:10-14` | ⚠️ Acción operativa | — |

> Los IDs SEC/FUN/OPS de esta tabla son los que consume `PROMPT_CORRECCIONES.md` para el trabajo pendiente.

---

## C. Cambios de configuración requeridos en el despliegue

1. **Rotar `JWT_SECRET` en Railway** (Variables del servicio) por una cadena larga y aleatoria (40+ caracteres). El backend ya se niega a arrancar en producción con el valor por defecto; al cambiarlo, todos los usuarios deberán volver a iniciar sesión (comportamiento correcto).
2. **Cambiar todas las contraseñas de producción** que estaban en las semillas (`admin2026`, `meza2026`, `ramirez2026`, `herrera2026`, `pinzon2026`) por unas fuertes y únicas, desde la sección Usuarios como administrador.
3. **`FRONTEND_URL`**: fijar la URL exacta del frontend en producción para cerrar CORS.
4. **`UPLOAD_DIR`**: apuntar a un volumen persistente (en Railway el disco es efímero; sin esto, los soportes subidos se pierden en cada redespliegue).
5. **(Opcional) SMTP e IMAP**: variables de correo saliente y del buzón de facturas; mantener `IMAP_ALLOW_INSECURE_TLS` sin definir (validación TLS activa).

---

## D. Riesgos residuales y recomendaciones (fuera del alcance del código de esta pasada)

- **Buzón IMAP compartido (SEC-04):** separar qué correos ve cada empleado es un cambio de diseño (buzón por persona o filtrado por dirección del remitente/usuario). Mientras tanto, cualquier comercial puede leer adjuntos de todo el buzón. Priorizar su rediseño.
- **Actualizaciones mayores de dependencias (SEC-05):** planear la subida de `vite`/`vite-plugin-pwa` y de la cadena `imap`/`uuid` en una rama dedicada con pruebas de humo (el build de producción no se ve afectado por las de esbuild/vite, que son del servidor de desarrollo).
- **Pruebas automatizadas (FUN-01):** agregar una suite mínima de integración (supertest) que congele el comportamiento de los controles críticos evita regresiones futuras. Detallado en `PROMPT_CORRECCIONES.md`.
- **Higiene operativa:** HTTPS forzado en Railway, backups periódicos de PostgreSQL, y depuración de los datos "basura"/"QA-TEST" preexistentes en producción (listados en `AUDITORIA_INTERNA_COLSEIN.md`).

---

## E. Verificación realizada

- ✅ `npm install` en raíz, backend y frontend sin errores.
- ✅ `npm run build` del frontend genera el bundle correctamente tras los cambios.
- ✅ Rutas y modelos del backend cargan sin errores de sintaxis (`node -e require(...)`).
- ✅ **Prueba del Fix SEC-01:** el bundle de producción ya **no contiene** las cadenas `admin2026`/`meza2026`/`ramirez2026` (verificado con `grep` sobre `dist/`), confirmando que `import.meta.env.DEV` elimina el bloque de credenciales en producción.
- ✅ `npm audit fix` no destructivo: frontend 5→3 alertas (la alta `form-data` resuelta), backend 10→8 alertas (restantes solo con cambios mayores).

Las correcciones aplicadas en esta auditoría son SEC-01, SEC-02, SEC-03 y DOC-01. El resto queda documentado arriba y trasladado a `PROMPT_CORRECCIONES.md`.
