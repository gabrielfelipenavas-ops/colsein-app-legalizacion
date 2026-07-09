# Prompt de Correcciones — App de Legalizaciones COLSEIN

> **Cómo usarlo:** primero responde las decisiones marcadas con `▸ DECISIÓN` al inicio de cada hallazgo que lo pida (basta escribir la opción elegida junto al hallazgo). Luego copia todo el bloque de abajo (desde "## PROMPT") y pégalo como primera instrucción en una sesión nueva de Claude Code (Fable 5) abierta sobre este repositorio, preferiblemente en una rama dedicada (ej. `fix/correcciones-auditoria`).
>
> Este prompt fue generado a partir del `INFORME_AUDITORIA.md`. Los hallazgos SEC-01, SEC-02, SEC-03 y DOC-01 **ya fueron corregidos** en la auditoría; aquí solo van los **pendientes** y los que **requieren tu decisión**.

---

## PROMPT

Actúa como desarrollador senior de aplicaciones (Node.js/Express/Sequelize + React/Vite) especializado en seguridad. Vas a **corregir los hallazgos pendientes** de una auditoría ya realizada sobre esta aplicación de legalizaciones de gastos y kilometraje de COLSEIN S.A.S. Trabaja de forma autónoma; solo detente si una corrección exige una decisión de negocio que no esté ya resuelta en este documento.

### Contexto de la aplicación (no necesitas leer nada más para empezar)

- **Stack:** Node.js 18 + Express 4 + Sequelize 6 + PostgreSQL 16 (backend, puerto 3001); React 18 + Vite 5 + Tailwind (frontend, puerto 5173); JWT (auth), Multer (archivos), Tesseract.js + sharp (OCR local), ExcelJS (reportes), imap-simple (buzón de facturas), Railway (despliegue).
- **Estructura backend:** `backend/src/routes/` (auth, kilometraje, anticipos, expenses, legalizations, authorizations, trips, reports, accounting, clients, users, config, email, establishments, notifications), `backend/src/middleware/` (auth.js con `auth` y `requireRole`, upload.js), `backend/src/models/index.js`, `backend/src/roles.js` (define `ROLES`, `VISORES`, `ADMIN_SISTEMA`, `APROBADORES`, `AUTORIZADORES_ESPECIALES`, `puedeAprobar`), `backend/src/services/`.
- **Estructura frontend:** `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/services/api.js`, `frontend/src/context/AuthContext.jsx`.
- **Comandos:** `cd backend && npm install`; `cd frontend && npm install && npm run build`; el backend arranca con `node src/index.js` (arranca aunque no haya BD, útil para pruebas de humo).

### Reglas de negocio que NO puedes romper (verifícalas, no las alteres)

1. Tarifas km: CARRO $600.65/km, MOTO $507.03/km, configurables en `system_config`.
2. Peajes, parqueaderos y taxis exigen foto de soporte obligatoria; taxis además requieren autorización previa.
3. Kilometraje se entrega en los primeros 5 días del mes siguiente; anticipos se legalizan máximo 3 días tras el retorno; no se reconoce km hacia oficinas de Colsein.
4. Flujo de aprobación jerárquico: vendedor → líder regional → gerente de ventas → control interno. Nadie aprueba lo suyo. Lo que envía un gerente SOLO lo autoriza el presidente. Línea AVEVA independiente (desarrollador_aveva → gerente_aveva → presidente). El presidente queda aprobado automáticamente. Toda esta lógica vive en `backend/src/roles.js` (`puedeAprobar`) y NO debe modificarse.
5. Legalizaciones enviadas quedan bloqueadas; solo vuelven a borrador con una autorización tipo `modificacion` aprobada.
6. Moneda COP con punto de miles, fechas DD/MM/YYYY, textos en español (Colombia).

### Hallazgos a corregir

Corrige en este orden (por severidad y dependencias). Cada hallazgo tiene ID (del informe), problema, ubicación, causa raíz, corrección esperada y criterio de verificación.

---

#### SEC-04 — 🟠 Alta — Buzón IMAP compartido: fuga de correos/adjuntos entre empleados

`▸ DECISIÓN (elige una y anótala aquí antes de pegar el prompt):`
- **(A) Restringir por rol (rápido, recomendado como mitigación inmediata):** limitar `search`, `attachment` y `match` a roles de auditoría/contabilidad/dirección (`VISORES` o `CONTABLES`), quitando el acceso a los comerciales. Simple, no rompe el modelo, pero los comerciales pierden el auto-cruce de facturas.
- **(B) Aislar por usuario (correcto a largo plazo):** al descargar/guardar un adjunto, verificar que el `email_uid` provenga de un `EmailMatch` que pertenezca a `req.user.id`; y filtrar la búsqueda por la dirección de correo del propio usuario (`req.user.email`) como remitente/destinatario. Más trabajo, conserva la función por empleado.
- **(C) No cambiar ahora:** dejar documentado y planear rediseño de buzón por persona. (Si eliges esta, omite el hallazgo.)

- **Problema:** cualquier usuario con sesión puede buscar en TODO el buzón corporativo y descargar CUALQUIER adjunto cambiando el `:uid` (IDOR sobre el correo).
- **Ubicación:** `backend/src/routes/email.js` → `GET /search` (línea ~24), `GET /attachment/:uid/:filename` (línea ~137), `POST /match` (línea ~169), `POST /save-match` (línea ~332).
- **Causa raíz:** un único buzón con credenciales fijas y sin filtro por propietario en las consultas IMAP.
- **Corrección esperada (según la opción elegida):**
  - Opción A: envolver esas rutas con `requireRole(...)` importando el conjunto de roles autorizado desde `../roles`. `save-match` ya valida que el gasto sea del usuario; mantén esa validación.
  - Opción B: en `attachment` y `save-match`, antes de conectar a IMAP, comprobar que exista un `EmailMatch` con ese `email_uid` y `user_id: req.user.id` (o, para `search`, agregar el correo del usuario a los criterios IMAP `FROM`/`TO`).
- **Verificación:** con un usuario comercial, `GET /api/email/attachment/<uid-ajeno>/<archivo>` debe responder 403/404; con la opción B, un comercial solo ve/descarga adjuntos de sus propios cruces.

---

#### SEC-06 — 🟢 Baja — `GET /api/config` expone toda la configuración

- **Problema:** devuelve todas las claves de `system_config` a cualquier usuario autenticado. Hoy solo hay tarifas (que el cliente necesita), pero cualquier clave sensible futura quedaría expuesta.
- **Ubicación:** `backend/src/routes/config.js:7`.
- **Causa raíz:** la consulta devuelve todas las filas sin lista blanca.
- **Corrección esperada:** devolver **solo** una lista blanca de claves públicas (p. ej. `tarifa_carro`, `tarifa_moto` y demás claves de UI). Las claves administrativas, si existen, que se sirvan por una ruta separada protegida con `requireRole(...ADMIN_SISTEMA)`. No cambies el `PUT` (ya está protegido).
- **Verificación:** `GET /api/config` como comercial devuelve solo las claves públicas; agregar una clave marcada como sensible no aparece en esa respuesta.

---

#### FUN-01 — 🟡 Media — Faltan pruebas automatizadas de los controles críticos

- **Problema:** no hay pruebas; los controles de seguridad y los cálculos dependen de verificación manual y pueden regresar sin aviso.
- **Ubicación:** todo el backend (no existe carpeta de tests).
- **Corrección esperada:** agregar pruebas de integración con `jest` + `supertest` (usar SQLite en memoria o una BD de prueba; si el modelo lo permite, `sequelize` con `dialect: 'sqlite'` y `storage: ':memory:'`). Cubrir como mínimo:
  1. **Login:** credenciales válidas → 200 + token; inválidas → 401 con mensaje genérico.
  2. **IDOR kilometraje:** un usuario A no puede leer `GET /api/kilometraje/reports/:id` de un usuario B (403); un `VISOR` sí.
  3. **Flujo de aprobación:** nadie aprueba lo suyo (403); un rol sin nivel jerárquico no puede aprobar lo de un gerente (403); el camino feliz líder→gerente funciona.
  4. **Bloqueo tras envío:** editar (`PUT /api/legalizations/:id`) o re-asociar gastos de una legalización en estado `enviado` → 400/403.
  5. **Cálculo de totales:** crear entradas de km y verificar `valor_km = round(total_km * tarifa, 2)` y que `recalculateReport` sume correctamente; y `computeLegalizable` (propina excluida, servicio tope 10%).
- Añade el script `"test": "jest"` en `backend/package.json`. Todas las pruebas deben pasar al terminar.
- **Verificación:** `cd backend && npm test` en verde.

---

#### SEC-05 — 🟡 Media — Dependencias con vulnerabilidades que requieren actualización mayor

`▸ DECISIÓN:` ¿autorizas actualizaciones **mayores** (breaking) de librerías? **(Sí / No)**. Si **No**, omite este hallazgo y déjalo documentado.

- **Problema:** quedan vulnerabilidades que `npm audit fix` no resuelve sin `--force`: backend cadena `imap`/`utf7`/`uuid` (vía sequelize/exceljs); frontend `esbuild`/`vite`/`vite-plugin-pwa` (afecta al servidor de desarrollo, no al build de producción).
- **Ubicación:** `backend/package.json`, `frontend/package.json`.
- **Corrección esperada (solo si autorizaste):** en una rama aislada, subir `vite` y `vite-plugin-pwa` a versiones sin la vulnerabilidad de esbuild y verificar que `npm run build` y el arranque en dev funcionen; evaluar reemplazar `imap-simple`/`imap` por una librería mantenida (p. ej. `imapflow`) — esto toca `backend/src/routes/email.js` y debe probarse a fondo. No apliques `npm audit fix --force` a ciegas.
- **Verificación:** `npm audit` sin vulnerabilidades altas; `npm run build` (frontend) y arranque del backend OK; el cruce de correo sigue funcionando.

---

### Reglas de trabajo

1. **Prioriza** por severidad: SEC-04 → SEC-06 → FUN-01 → SEC-05.
2. **Commits atómicos** en español, uno por hallazgo, referenciando el ID: `fix(seguridad): SEC-04 …`, `test: FUN-01 …`.
3. **No rompas el build:** tras cada grupo de cambios corre `cd frontend && npm run build`, arranca el backend y ejecuta `npm test`. Ningún commit puede dejar la app sin compilar.
4. **No alteres reglas de negocio** ni la lógica de `roles.js`. Si un cambio necesita tocar el modelo de datos, hazlo con migración de Sequelize reversible y explícalo.
5. **No subas secretos** ni valores reales en `.env.example`.
6. Si un hallazgo quedó marcado como "No cambiar ahora" en su decisión, sáltalo y anótalo.

### Entregable de cierre

Al terminar, **actualiza la tabla de `INFORME_AUDITORIA.md`** cambiando el estado de cada hallazgo corregido a "✅ Corregido" con el hash del commit que lo resuelve, y deja una nota breve al final del informe indicando qué quedó pendiente y por qué. Confirma que `npm run build` (frontend), el arranque del backend y `npm test` pasan.

---

*Fin del prompt.*

### Recordatorio de pasos operativos (no son código — OPS-01)

Independiente de las correcciones de código, en Railway hay que: (1) rotar `JWT_SECRET` por una clave fuerte, y (2) cambiar todas las contraseñas de producción que estaban en las semillas (`admin2026`, etc.). Sin esto, el sistema sigue siendo vulnerable aunque el código esté corregido.
