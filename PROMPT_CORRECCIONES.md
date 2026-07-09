# Prompt de correcciones pendientes — Sistema de Legalizaciones COLSEIN

> Copia y pega TODO este documento como prompt en una nueva sesión de IA con acceso al repositorio. Es autocontenido: no necesitas leer el informe de auditoría.

---

Actúa como desarrollador senior full-stack. Vas a ejecutar las correcciones pendientes de una auditoría ya realizada sobre la aplicación de legalizaciones de gastos y kilometraje de COLSEIN S.A.S. (NIT 800002030), empresa colombiana.

## Contexto de la aplicación

- **Stack**: Node.js 20 + Express 4 + Sequelize 6 + PostgreSQL 16 (backend, puerto 3001, código en `backend/src/`); React 18 + Vite 5 + Tailwind 3 (frontend, `frontend/src/`); JWT (HS256, secreto en `JWT_SECRET`); Multer para archivos en `/uploads` (protegido: exige JWT por header o cookie httpOnly `colsein_files`); despliegue en Railway (`railway.toml` corre `db:migrate` al arrancar).
- **Rutas backend**: `auth, users, clients, kilometraje, anticipos, expenses, reports, legalizations, email, config, notifications, trips, authorizations, establishments, accounting` en `backend/src/routes/`. Middleware en `backend/src/middleware/auth.js` (`auth`, `requireRole`); jerarquía de roles en `backend/src/roles.js` (`puedeAprobar`, `aprobadoresDe`).
- **Pruebas**: `cd backend && npm test` (jest + supertest; requiere PostgreSQL local, usa la BD `colsein_gastos_test` que se crea/migra sola). Hay 21 pruebas que DEBEN seguir pasando.
- **Build**: `cd frontend && npm run build` debe compilar sin errores tras cada cambio.

## Reglas de negocio que NO puedes romper

- Tarifas km: CARRO $600.65/km, MOTO $507.03/km, configurables en `system_config` (claves `tarifa_carro`, `tarifa_moto`).
- Flujo de aprobación: comercial → líder regional (revisa) → gerente de ventas (aprueba) → control interno audita. Nadie aprueba sus propias solicitudes. Lo de un gerente SOLO lo autoriza el presidente. Línea AVEVA independiente: desarrollador_aveva → gerente_aveva → presidente. El presidente queda aprobado automáticamente.
- Legalizaciones/reportes enviados quedan bloqueados (el backend responde 409); solo vuelven a borrador con una autorización tipo `modificacion` aprobada por gerente/presidencia.
- Peajes y parqueaderos exigen foto; taxis exigen tipo+origen+destino siempre y foto solo para apps (Uber/InDriver/DiDi/Beat/Cabify) — regla implementada en `backend/src/routes/kilometraje.js` (submit) y `frontend/src/utils/helpers.js`.
- Moneda COP con punto de miles, fechas DD/MM/YYYY, toda la interfaz en español (Colombia). La app opera en UTC-5: usa `parseFecha`/`periodoDe`/`hoyBogota` de `backend/src/utils/dates.js` para fechas `YYYY-MM-DD` (nunca `new Date('YYYY-MM-DD')` directo).

## Hallazgos a ejecutar (en este orden)

### 1. PEN-03 — Contraseñas temporales aleatorias y cambio forzado (severidad Media, Seguridad)

- **Archivos**: `backend/src/routes/users.js` (POST `/` y PUT `/:id`), `backend/src/models/index.js` (modelo User), nueva migración en `backend/migrations/`, `backend/src/routes/auth.js` (login), `frontend/src/pages/UsuariosPage.jsx`, `frontend/src/context/AuthContext.jsx` + un modal de cambio obligatorio.
- **Causa raíz**: el administrador digita la contraseña del usuario nuevo (o del restablecimiento) y esta se envía por correo; no es aleatoria, no caduca y no se fuerza su cambio.
- **Corrección esperada**:
  1. Migración reversible que agregue `must_change_password BOOLEAN NOT NULL DEFAULT false` a `users`.
  2. En `POST /users` y en el restablecimiento por `PUT /users/:id`: si no llega `password`, generar una aleatoria (`crypto.randomBytes(9).toString('base64url')`), marcarla `must_change_password: true`, y enviarla con `sendCredentialsEmail` (ya existe en `backend/src/services/notifications.js`). Si el admin envía una contraseña manual, también marcar `must_change_password: true`.
  3. En el login (`POST /auth/login`), incluir `must_change_password` en la respuesta. `PUT /auth/password` ya exige la contraseña actual: al cambiarla, poner `must_change_password: false`.
  4. Frontend: si `user.must_change_password` es true tras el login, abrir `ChangePasswordModal` (ya existe en `frontend/src/components/ChangePasswordModal.jsx`) de forma obligatoria (sin botón de cerrar) antes de usar la app.
- **Verificación**: prueba de integración nueva: crear usuario sin password → responde 201 y no expone la contraseña; login con la temporal → `must_change_password: true`; tras `PUT /auth/password` → false. `npm test` completo en verde.

### 2. PEN-01 — Hacer cumplir los plazos de entrega (severidad Media, Regla de negocio — REQUIERE DECISIÓN)

- **Archivos**: `backend/src/routes/kilometraje.js` (POST `/reports/:id/submit`), `backend/src/routes/legalizations.js` (POST `/:id/submit`), `backend/src/utils/dates.js`.
- **Causa raíz**: las reglas "el kilometraje se entrega en los primeros 5 días calendario del mes siguiente" y "los anticipos se legalizan máximo 3 días después del retorno" solo existen como texto informativo; el backend acepta envíos en cualquier fecha.
- **Opciones (pedir decisión a COLSEIN antes de implementar)**:
  - (a) **Bloquear**: rechazar con 400 el envío de kilometraje después del día 5 del mes siguiente al periodo, y la legalización más de 3 días después de `fecha_regreso` del anticipo vinculado. Riesgo: impide entregas tardías legítimas.
  - (b) **Advertir (recomendada)**: aceptar el envío pero marcarlo (`fuera_de_plazo: true` en el reporte/legalización — requiere migración) y mostrarlo en la bandeja de aprobaciones y en la notificación al aprobador.
  - (c) Solo reporte mensual para control interno.
- **Implementación común**: calcular el plazo con `hoyBogota()` (UTC-5), nunca con la hora del servidor.
- **Verificación**: pruebas con fechas dentro y fuera de plazo según la opción elegida.

### 3. PEN-02 — Verificar la autorización previa de taxis (severidad Media, Regla de negocio — REQUIERE DECISIÓN)

- **Archivos**: `backend/src/routes/kilometraje.js` (submit), `backend/src/routes/authorizations.js`, `frontend/src/components/AddEntryModal.jsx`.
- **Causa raíz**: la app permite "Solicitar autorización" de taxi (crea `AuthRequest` tipo `taxi`), pero al enviar el reporte no se verifica que exista una autorización **autorizada**; el texto actual de la app dice "queda pendiente para la legalización".
- **Opciones (pedir decisión)**:
  - (a) Al enviar un reporte con `taxis > 0`, exigir que el usuario tenga al menos una `AuthRequest` tipo `taxi` con `estado: 'autorizado'` cuyo `created_at` sea del mismo mes del reporte (bloquea si no).
  - (b) Solo advertir al aprobador en la bandeja ("este reporte incluye taxis sin autorización registrada").
  - (c) Vincular la autorización a la entrada de km (`authorization_id` en `kilometrage_entries`, con migración) para trazabilidad exacta — más trabajo, más preciso.
- **Verificación**: prueba que envía un reporte con taxi sin autorización y valida el comportamiento elegido.

### 4. PEN-04 — Restringir el acceso al buzón IMAP (severidad Media, Autorización — REQUIERE DECISIÓN)

- **Archivos**: `backend/src/routes/email.js` (GET `/search`, GET `/attachment/:uid/:filename`, POST `/match`).
- **Causa raíz**: cualquier usuario autenticado puede buscar y descargar adjuntos de TODO el buzón IMAP configurado (`IMAP_USER`). Es aceptable solo si es un buzón dedicado exclusivamente a recibir facturas.
- **Opciones (pedir decisión)**:
  - (a) Confirmar que `IMAP_USER` es un buzón dedicado a facturas → documentarlo en README y no tocar código.
  - (b) Restringir esas rutas con `requireRole('contabilidad', 'administrador', 'control_interno', ...ADMIN_SISTEMA)` (importar de `../roles`). OJO: hoy los comerciales usan `/search` y `/match` desde FacturasPage para cruzar sus gastos — la opción (b) les quita esa función; evaluar con producto.
- **Verificación**: según la opción, prueba de 403 para rol comercial o nota en README.

### 5. PEN-06 — Dependencias residuales (severidad Media, Dependencias)

- **Archivos**: `backend/package.json`, `frontend/package.json`.
- **Causa raíz**: (1) `imap-simple` (abandonada) arrastra `utf7→semver` con ReDoS (high); (2) `vite@5/esbuild` tiene una vulnerabilidad moderate que afecta SOLO al servidor de desarrollo.
- **Corrección esperada**:
  1. Migrar `backend/src/routes/email.js` de `imap-simple` a **`imapflow`** (mantenida): reemplazar `imaps.connect/openBox/search` por `ImapFlow` + `fetch` con `source: true` y seguir parseando con `mailparser` (`simpleParser`). Mantener exactamente el mismo contrato JSON de las rutas.
  2. Actualizar Vite a la versión mayor estable actual (`npm install -D vite@latest @vitejs/plugin-react@latest vite-plugin-pwa@latest`), verificar `npm run dev` y `npm run build`, y que el PWA siga generándose (`dist/sw.js`).
- **Verificación**: `npm audit` sin high en backend; build y `npm test` en verde; probar manualmente `GET /api/email/search` si hay IMAP configurado.

### 6. PEN-07 — Propiedad por archivo en /uploads (severidad Baja, Autorización)

- **Archivos**: `backend/src/index.js` (middleware de `/uploads`), `backend/src/middleware/upload.js`, rutas que guardan `imagen_url`/`*_foto`.
- **Causa raíz**: `/uploads` exige sesión válida, pero no valida que el archivo pertenezca al usuario o a alguien que él pueda ver (VISORES). Mitigado por nombres UUID.
- **Corrección esperada (opcional)**: guardar los archivos bajo subcarpeta por usuario (`/uploads/u<id>/AAAA-MM/uuid.ext`) y en el middleware permitir el acceso si `req` es el dueño (`/u<id>/`) o su rol está en `VISORES` (de `backend/src/roles.js`); mantener compatibilidad con las rutas antiguas ya guardadas en BD (sin subcarpeta de usuario → solo exigir sesión, como hoy).
- **Verificación**: prueba: comercial A sube foto; comercial B con sesión recibe 403 al pedirla; el gerente la ve 200.

### 7. PEN-08 — Caché PWA de /uploads tras cerrar sesión (severidad Baja, Privacidad)

- **Archivo**: `frontend/vite.config.js` (workbox `runtimeCaching`).
- **Causa raíz**: `/uploads` se cachea con `NetworkFirst` 7 días; las imágenes quedan en el dispositivo tras cerrar sesión.
- **Corrección esperada**: cambiar el handler de `/uploads` a `NetworkOnly`, o borrar el caché `uploads-cache` al hacer logout (`caches.delete('uploads-cache')` en `frontend/src/context/AuthContext.jsx`).
- **Verificación**: build OK; tras logout, la imagen no se sirve offline.

### 8. PEN-09 — Confirmar la regla de foto para taxis y actualizar CLAUDE.md (severidad Baja, Documentación — REQUIERE DECISIÓN)

- **Archivos**: `CLAUDE.md`, `backend/src/routes/kilometraje.js` (constante `APPS_TAXI_CON_FACTURA`), `frontend/src/utils/helpers.js`.
- **Causa raíz**: CLAUDE.md dice "taxis requieren foto obligatoria"; la app implementa (por decisión documentada en el código) foto obligatoria SOLO para apps (Uber/InDriver/DiDi/Beat/Cabify), opcional para taxi convencional/transporte público. El backend fue alineado con la app.
- **Corrección esperada**: preguntar a COLSEIN cuál es la regla oficial. Si es "solo apps": actualizar CLAUDE.md. Si es "todos los taxis": revertir la exención en `helpers.js` (función `requiereFacturaTaxi` → siempre true) y en el submit del backend, y avisar que los taxis convencionales ya registrados sin foto bloquearán el envío.
- **Verificación**: prueba del submit acorde a la regla elegida; CLAUDE.md coherente con el código.

### 9. PEN-05 — Token en sessionStorage (severidad Media, informativo — NO implementar sin decisión)

- Migrar la autenticación completa a cookies httpOnly + protección CSRF es un cambio mayor (backend y frontend). Solo abordarlo si COLSEIN lo prioriza; mientras tanto, mantener la política actual: cero `dangerouslySetInnerHTML`, dependencias de render auditadas.

## Reglas de trabajo

- Commits atómicos en español: `fix(seguridad): ...`, `fix(funcional): ...`, `fix(ux): ...`, `docs: ...`.
- Después de cada grupo de cambios: `cd frontend && npm run build`, `cd backend && npm test` (necesita PostgreSQL; usa `docker-compose up -d` o un PostgreSQL local con usuario/clave `postgres`/`postgres`) y arranque del backend (`JWT_SECRET=<cualquier-cadena-larga> node src/index.js`). Ningún commit puede dejar la app sin compilar ni las 21+ pruebas en rojo.
- Cambios de modelo de datos SIEMPRE con migración de Sequelize reversible.
- No subas secretos; no pongas valores reales en `.env.example`.

## Al terminar

Actualiza la tabla de hallazgos de `INFORME_AUDITORIA.md`: para cada ID ejecutado (PEN-01 … PEN-09) cambia el estado a "Corregido" y anota el hash del commit que lo corrige; los que la empresa decida no ejecutar, márcalos "Descartado por decisión de negocio" con una línea del porqué.
