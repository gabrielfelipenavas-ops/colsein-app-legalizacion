# Prompt de Funcionalidades — App de Legalizaciones COLSEIN

> **Cómo usarlo:** primero responde las decisiones marcadas con `▸ DECISIÓN` (basta escribir la opción elegida junto al punto). Luego copia todo el bloque de abajo (desde "## PROMPT") y pégalo como primera instrucción en una sesión nueva de Claude Code abierta sobre este repositorio, preferiblemente en una rama dedicada (ej. `feat/revision-y-pdf-firma`).
>
> Este prompt agrega **dos funcionalidades** a la app: (1) un usuario de **revisión** (asistente de gerencia) que ve y revisa todas las legalizaciones y valida sus facturas, y (2) la **descarga en PDF** de la legalización con la **firma del colaborador**, donde el colaborador sube una imagen de su firma o la dibuja en la app (sin imprimir, firmar y escanear).

---

## Decisiones previas

**▸ DECISIÓN 1 — Alcance del usuario de revisión.** ¿Qué puede hacer la asistente de gerencia con una legalización?
- **(A) Solo revisar (recomendado):** ve todas, valida cada factura y marca la legalización como `revisado` (o la devuelve como `rechazado` con comentario). La aprobación final la siguen dando gerencia/presidencia. Respeta la jerarquía actual sin tocarla.
- **(B) Revisar y aprobar:** además de revisar, puede dar la aprobación final. (No recomendado: rompe el principio "nadie aprueba fuera de su nivel" y mezcla la revisión con la autorización.)

**▸ DECISIÓN 2 — Dónde vive la firma del colaborador.**
- **(A) Firma reusable en el perfil (recomendado):** el colaborador la registra una vez (sube imagen o la dibuja) y queda en su perfil; se estampa en cada PDF. Puede reemplazarla cuando quiera.
- **(B) Firma por legalización:** se captura al momento de generar/enviar cada legalización. Más fiel a "firmó este documento", pero obliga a firmar cada vez.

**▸ DECISIÓN 3 — Librería para el PDF.**
- **(A) `pdfkit` (recomendado):** JS puro, liviano, embebe imágenes (la firma) y funciona en Railway sin navegador. Una sola dependencia backend nueva.
- **(B) `puppeteer`/HTML→PDF:** más fiel a un diseño HTML, pero pesado y requiere Chromium en producción (frágil en Railway). Evitar salvo que ya exista esa infraestructura.

---

## PROMPT

Actúa como desarrollador full-stack senior (Node.js/Express/Sequelize + React/Vite) de la app de legalizaciones de gastos y kilometraje de COLSEIN S.A.S. Vas a **implementar dos funcionalidades nuevas** respetando la arquitectura y las reglas de negocio existentes. Trabaja de forma autónoma; solo detente si una decisión ya resuelta arriba te falta.

### Contexto de la aplicación (ya verificado en el código; no necesitas re-descubrirlo)

- **Stack:** Node.js 18 + Express 4 + Sequelize 6 + PostgreSQL 16 (backend, puerto 3001); React 18 + Vite 5 + Tailwind + React Router 6 + Axios + Lucide (frontend, puerto 5173). JWT (auth), Multer (subida de archivos), sharp (procesado de imágenes), ExcelJS + archiver (reportes/descargas). Despliegue en Railway (disco efímero; los archivos van a `process.env.UPLOAD_DIR || './uploads'`).
- **Roles** (`backend/src/roles.js`): `ROLES` define comercial, lider_regional, gerente_ventas, control_interno, administrador, contabilidad, gerente_general, presidente, gerente_aveva, desarrollador_aveva. Conjuntos: `APROBADORES`, `GERENTES`, `VISORES` (ven/descargan todo), `AUTORIZADORES_ESPECIALES`, `ADMIN_SISTEMA`. Funciones `puedeAprobar(aprobadorRol, emisorRol)` y `aprobadoresDe(emisorRol)`. **`puedeAprobar` NO se modifica.**
- **Modelo de datos** (`backend/src/models/index.js`):
  - `User`: campos `nombre, cedula, email, password_hash, rol (ENUM), zona, vehiculo_tipo, placa, telefono, activo`. `tableName: 'users'`.
  - `ExpenseLegalization`: `user_id, travel_request_id, ciudades_visitadas, moneda, gasto_real_total, valor_anticipo, pago_favor_empresa, pago_favor_empleado, estado (ENUM: borrador|enviado|revisado|aprobado|rechazado), revisado_por, aprobado_por, observaciones_imprevistos`. Asociada a `User`, `TravelRequest` y `Expense` (as `expenses`).
  - `Expense`: incluye `valor, valor_legalizable, categoria, establecimiento, nit_establecimiento, numero_factura, imagen_url, validado (BOOLEAN), observaciones`.
- **Rutas de legalizaciones** (`backend/src/routes/legalizations.js`): `GET /` (los `VISORES` ven todas; el resto solo las suyas), `GET /pending`, `GET /:id` (dueño o `VISORES`), `POST /`, `PUT /:id`, `PUT /:id/expenses`, `POST /:id/submit`, `POST /:id/approve` (protegida con `requireRole(...APROBADORES)`; usa `puedeAprobar`).
- **Descargas** (`backend/src/routes/reports.js`): `GET /legalizacion/:id/excel` y `GET /legalizacion/:id/facturas` (ZIP). Patrón de acceso en todas: `if (leg.user_id !== req.user.id && !VISORES.includes(req.user.rol)) return 403`. El generador está en `backend/src/services/excelGenerator.js` (`generateLegalizationExcel(legalization, expenses, user, travelRequest)`).
- **Middleware** (`backend/src/middleware/auth.js`): exporta `auth` (valida JWT, deja `req.user` con `id, rol, nombre, email`) y `requireRole(...roles)`. Subida de archivos: `backend/src/middleware/upload.js` (Multer con filtro de MIME/extensión ya endurecido).
- **Frontend:** `frontend/src/components/AppLayout.jsx` arma la barra de navegación por rol (`APPROVER_ROLES`, `CONTABLE_ROLES`, `ADMIN_ROLES`). Páginas en `frontend/src/pages/` (incluye `LegalizacionPage.jsx`, `AprobacionesPage.jsx`, `ReportesPage.jsx`). Cliente HTTP en `frontend/src/services/api.js`. Sesión en `frontend/src/context/AuthContext.jsx`.
- **Comandos:** `cd backend && npm install`; `cd frontend && npm install && npm run build`. El backend arranca con `node src/index.js` (arranca aunque no haya BD, útil para pruebas de humo). Migraciones: `cd backend && npx sequelize-cli db:migrate`.

### Reglas de negocio que NO puedes romper

1. Jerarquía de aprobación: vendedor → líder regional → gerente de ventas → control interno; lo de un gerente solo lo autoriza el presidente; línea AVEVA independiente; el presidente se auto-aprueba. Toda esa lógica vive en `roles.js` (`puedeAprobar`) y **no se toca**.
2. Nadie aprueba lo suyo. La legalización enviada queda bloqueada para su dueño (solo vuelve a borrador con una autorización `modificacion` aprobada).
3. Estados de la legalización: `borrador → enviado → revisado → aprobado` (o `rechazado`). El nuevo flujo de revisión debe encajar en el estado **`revisado`** ya existente, sin inventar estados nuevos.
4. Moneda COP con punto de miles, fechas DD/MM/YYYY, textos en español (Colombia).
5. Peajes/parqueaderos/taxis exigen foto de soporte; tarifas km desde `system_config`. (No las alteres.)
6. No subas secretos ni valores reales a `.env.example`. La firma es un dato personal: guárdala en `UPLOAD_DIR`, sírvela solo con sesión y nunca la expongas en respuestas de listado públicas.

---

### FUNCIONALIDAD 1 — Usuario de revisión (asistente de gerencia)

**Objetivo:** un rol nuevo `asistente_gerencia` (la revisora) que **ve todas las legalizaciones**, **valida factura por factura** que estén bien hechas y **marca la legalización como revisada** (o la devuelve con comentario). Según la **DECISIÓN 1**.

**Backend**

1. **Rol nuevo.**
   - Agrega `ASISTENTE_GERENCIA: 'asistente_gerencia'` a `ROLES` en `backend/src/roles.js`.
   - Inclúyelo en **`VISORES`** (para que vea/descargue todo). **No** lo agregues a `APROBADORES` (no da la aprobación final) salvo que la DECISIÓN 1 sea (B).
   - Añádelo al ENUM `rol` del modelo `User` (`backend/src/models/index.js`).
   - Crea una **migración Sequelize** que haga `ALTER TYPE "enum_users_rol" ADD VALUE IF NOT EXISTS 'asistente_gerencia'`. (En PostgreSQL no se puede quitar un valor de un ENUM en el `down`; documenta el `down` como no-op con un comentario.)
2. **Revisión de la legalización.** Nueva ruta en `backend/src/routes/legalizations.js`:
   - `POST /api/legalizations/:id/review` protegida con `requireRole(ROLES.ASISTENTE_GERENCIA, ...GERENTES, ROLES.PRESIDENTE, ROLES.CONTROL_INTERNO)` (los que revisan/auditan).
   - Body `{ action: 'revisar' | 'rechazar', comentarios }`. `revisar` → `estado='revisado'`, `revisado_por=req.user.id`. `rechazar` → `estado='rechazado'` (exige `comentarios`, igual que `/approve`). Solo permite si el estado actual es `enviado` o `revisado`. No puede revisar lo suyo.
   - Registra un `Approval` (`tipo: 'legalizacion'`, `estado`, `comentarios`) y notifica al dueño con `notify(...)` (usa el patrón existente en `/approve`).
3. **Validación de facturas.** Nueva ruta:
   - `PUT /api/expenses/:id/validate` protegida con `requireRole(ROLES.ASISTENTE_GERENCIA, ...GERENTES, ROLES.PRESIDENTE, ROLES.CONTROL_INTERNO, ROLES.CONTABILIDAD)`.
   - Body `{ validado: boolean, observaciones }`. Actualiza los campos `validado` y `observaciones` del `Expense`. Devuelve el gasto actualizado.
   - (Opcional) que `POST /:id/review` con `action:'revisar'` rechace si quedan facturas sin validar, para forzar la revisión completa. Déjalo como validación suave con mensaje claro.

**Frontend**

4. Agrega `asistente_gerencia` a `APPROVER_ROLES` en `AppLayout.jsx` para que le aparezca la pestaña de revisión. Renombra la etiqueta de esa pestaña a "Revisar" solo para este rol si es sencillo; si no, deja "Aprobar".
5. En `AprobacionesPage.jsx` (o una vista `RevisionPage.jsx` reutilizando su lógica): para el rol `asistente_gerencia`, al abrir una legalización muestra la lista de gastos con la miniatura/enlace de la factura (`imagen_url`), y por cada uno un control **Validar ✓ / Marcar con observación** que llama a `PUT /api/expenses/:id/validate`. Un botón **"Marcar revisada"** llama a `POST /api/legalizations/:id/review` y otro **"Devolver"** (rechazar con comentario). Reutiliza los estilos y componentes ya presentes en la página.
6. Añade los métodos correspondientes en `frontend/src/services/api.js` (`reviewLegalization`, `validateExpense`).

**Verificación F1**
- Un usuario `asistente_gerencia` ve todas las legalizaciones (`GET /api/legalizations` devuelve las de todos) y puede validar facturas y marcar `revisado`.
- No puede aprobar la final (a menos que DECISIÓN 1 = B): `POST /:id/approve` le responde 403.
- No puede revisar una legalización propia (403).

---

### FUNCIONALIDAD 2 — Descarga en PDF con firma del colaborador

**Objetivo:** que gerencia (y el dueño) descarguen la legalización en **PDF** con la **firma del colaborador** ya estampada. El colaborador registra su firma **subiendo una imagen** o **dibujándola en la app**; así no imprime, firma y escanea.

**Backend**

7. **Firma en el perfil** (según DECISIÓN 2; si es (A)):
   - Agrega `firma_url: Sequelize.STRING(500)` al modelo `User` + migración `addColumn('users', 'firma_url', ...)`.
   - Ruta `POST /api/auth/firma` (o `PUT /api/users/me/firma`) con `auth`. Acepta **dos formas**:
     - `multipart/form-data` con un archivo de imagen (usa el middleware `upload.js`), o
     - JSON `{ dataUrl }` con un PNG en base64 (la firma dibujada en canvas).
   - Procesa con `sharp` (recorta/normaliza a PNG con fondo transparente, ancho máx ~600px), guarda en `UPLOAD_DIR` con nombre no adivinable (p. ej. `firma_<userId>_<uuid>.png`) y guarda la ruta en `user.firma_url`. Devuelve `{ firma_url }`.
   - Añade `firma_url` a los campos que devuelve el login/`/me` para que el frontend sepa si ya hay firma (pero **no** la incluyas en listados de otros usuarios).
8. **Generador de PDF.** Crea `backend/src/services/pdfGenerator.js` con `generateLegalizationPdf(legalization, expenses, user, travelRequest)` usando la librería de la DECISIÓN 3 (recomendado `pdfkit`; agrégala a `backend/package.json`). El PDF debe contener, con formato colombiano (COP con punto de miles, fechas DD/MM/YYYY):
   - Encabezado COLSEIN S.A.S. (NIT 800002030), título "Legalización de Gastos", número, colaborador (nombre, cédula, zona), ciudades visitadas y consecutivo del anticipo si existe.
   - Tabla de gastos (fecha, categoría, establecimiento/NIT, N.º factura, valor, valor legalizable, "validado" ✓ si aplica).
   - Totales: gasto real, anticipo, pago a favor de empresa/empleado.
   - Bloque de firma al pie: la imagen de `user.firma_url` (si existe) sobre la línea "Firma del colaborador — {nombre} — C.C. {cedula}". Si no hay firma, deja la línea en blanco para firma física y no falles.
   - (Opcional) segunda línea de firma para el revisor/aprobador si el estado es `revisado`/`aprobado`.
9. **Ruta de descarga.** En `backend/src/routes/reports.js`, `GET /api/reports/legalizacion/:id/pdf` con `auth`, mismo control de acceso que las otras descargas (`if (leg.user_id !== req.user.id && !VISORES.includes(req.user.rol)) return 403`). Genera el PDF, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="Legalizacion_<nombre>_<id>.pdf"`, y hazle `pipe`/stream a `res`.

**Frontend**

10. **Captura de firma.** Crea `frontend/src/components/FirmaModal.jsx`:
    - Un `<canvas>` donde el colaborador dibuja con el dedo/mouse (pointer events; sin librerías nuevas), con botones **Limpiar** y **Guardar** (exporta `canvas.toDataURL('image/png')` y lo manda a `POST /api/auth/firma`).
    - Una pestaña alterna **"Subir imagen"** que envía el archivo por `multipart`.
    - Muestra la firma actual si `user.firma_url` ya existe, con opción de reemplazarla.
    - Ábrelo desde el perfil/menú (junto al ícono de llave de cambio de contraseña en `AppLayout.jsx`) y ofrécelo automáticamente la primera vez que el usuario intente descargar el PDF sin tener firma.
11. **Botón de descarga PDF.** En `LegalizacionPage.jsx`, `AprobacionesPage.jsx` y/o `ReportesPage.jsx`, junto a los botones de Excel/Facturas ya existentes, agrega **"Descargar PDF"** que pega a `GET /api/reports/legalizacion/:id/pdf` (descarga como blob, igual que el Excel actual). Disponible para el dueño y para los roles de gerencia/visores.
12. Añade en `api.js` los métodos `uploadFirma`/`saveFirmaDataUrl` y `downloadLegalizationPdf`.

**Verificación F2**
- Un colaborador registra su firma (dibujada y subida) → `user.firma_url` queda seteado; el archivo existe en `UPLOAD_DIR`.
- `GET /api/reports/legalizacion/:id/pdf` devuelve un PDF válido con la firma embebida; sin firma, no falla y deja el espacio para firma física.
- Un usuario de gerencia descarga el PDF de una legalización ajena (200); un comercial NO puede descargar la de otro (403).

---

### Reglas de trabajo

1. **Orden:** implementa primero FUNCIONALIDAD 1 (rol + revisión + validación de facturas), luego FUNCIONALIDAD 2 (firma + PDF). Cada una es independiente.
2. **Commits atómicos** en español, referenciando la funcionalidad: `feat(revision): rol asistente_gerencia y revisión de facturas`, `feat(pdf): descarga de legalización en PDF con firma`.
3. **Migraciones reversibles** donde el motor lo permita; para el `ADD VALUE` del ENUM documenta el `down` no-op. Ejecuta `npx sequelize-cli db:migrate` y confirma que corre.
4. **No rompas el build:** tras cada funcionalidad corre `cd frontend && npm run build`, arranca el backend (`node src/index.js`) y prueba las rutas nuevas. Ningún commit puede dejar la app sin compilar.
5. **No alteres** `puedeAprobar` ni la jerarquía; el rol de revisión encaja en el estado `revisado` existente.
6. **Seguridad:** todas las rutas nuevas con `auth`; las de revisión/validación con `requireRole(...)`; el PDF y la firma con el mismo control de acceso por dueño/`VISORES`. La firma es dato personal: nombre de archivo no adivinable y servida solo con sesión.
7. **Idioma y formato:** todo en español (Colombia), COP con punto de miles, fechas DD/MM/YYYY.

### Entregable de cierre

Al terminar, deja una nota breve (en el PR o en un `CHANGELOG`/sección de `CLAUDE.md`) con: el rol nuevo y cómo asignarlo, las rutas nuevas (`POST /legalizations/:id/review`, `PUT /expenses/:id/validate`, `POST /auth/firma`, `GET /reports/legalizacion/:id/pdf`), la dependencia de PDF añadida y las migraciones a correr en Railway. Confirma que `npm run build` (frontend), el arranque del backend y las migraciones pasan.

---

*Fin del prompt.*
