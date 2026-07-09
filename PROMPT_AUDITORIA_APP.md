# Prompt de Auditoría Integral — App de Legalizaciones COLSEIN

> **Cómo usarlo:** copia todo el bloque de abajo (desde "## PROMPT") y pégalo como primera instrucción en una sesión nueva de Claude Code (Fable 5) abierta sobre este repositorio. Idealmente ejecútalo en una rama nueva (ej. `audit/correcciones-integrales`) para revisar los cambios antes de fusionar.

---

## PROMPT

Actúa como un auditor senior de software con triple especialidad: **seguridad de aplicaciones (AppSec/OWASP)**, **QA funcional** y **diseño UX/UI**. Tu misión es auditar de punta a punta la aplicación de legalizaciones de gastos y kilometraje de COLSEIN S.A.S. que está en este repositorio, y **corregir directamente en el código** todos los problemas que encuentres, en orden de severidad.

Trabaja de forma autónoma: no me preguntes permiso para cada corrección. Solo detente a consultarme si una corrección cambia una regla de negocio o requiere una decisión de producto.

### Contexto de la aplicación

- **Stack:** Node.js 18 + Express 4 + Sequelize 6 + PostgreSQL 16 (backend, puerto 3001); React 18 + Vite 5 + Tailwind CSS 3 + React Router 6 + Axios (frontend, puerto 5173); JWT para autenticación; Multer para archivos; ExcelJS para reportes; despliegue en Railway.
- **Backend:** `backend/src/index.js` (entry), `backend/src/routes/` (auth, kilometraje, anticipos, expenses, legalizations, authorizations, trips, reports, accounting, clients, users, config, email, establishments, notifications), `backend/src/middleware/` (auth.js, upload.js), `backend/src/models/index.js`, `backend/src/services/` (excelGenerator, netsuiteFlat, notifications, distance), `backend/src/roles.js`.
- **Frontend:** `frontend/src/pages/` (Login, Home, Kilometraje, Facturas, Viajes, Legalizacion, Aprobaciones, Contabilidad, Reportes, Clientes, Usuarios), `frontend/src/components/`, `frontend/src/context/AuthContext.jsx`, `frontend/src/services/api.js`.
- Lee `CLAUDE.md` completo antes de empezar: contiene las reglas de negocio y el flujo de aprobaciones que **no puedes romper**.

### Reglas de negocio que las correcciones deben preservar (verifícalas, no las alteres)

1. Tarifas de km: CARRO $600.65/km, MOTO $507.03/km, configurables en `system_config`.
2. Peajes, parqueaderos y taxis exigen foto de soporte obligatoria; taxis además requieren autorización previa, tipo, origen y destino.
3. Kilometraje se entrega en los primeros 5 días calendario del mes siguiente; no se reconoce km hacia oficinas de Colsein; anticipos se legalizan máximo 3 días después del retorno.
4. Flujo de aprobación: vendedor → líder regional → gerente de ventas → control interno. Nadie aprueba sus propias solicitudes. Lo que envía un gerente solo lo autoriza el presidente. Línea AVEVA independiente (desarrollador_aveva → gerente_aveva → presidente). El presidente queda aprobado automáticamente.
5. Legalizaciones enviadas quedan bloqueadas; solo vuelven a borrador con una autorización de tipo `modificacion` aprobada por gerente/presidente.
6. Moneda COP con punto de miles, fechas DD/MM/YYYY, todo el texto de la interfaz en español (Colombia).

### FASE 0 — Reconocimiento (antes de tocar código)

1. Lee `CLAUDE.md`, `README.md`, `AUDITORIA_INTERNA_COLSEIN.md`, `package.json` de raíz, backend y frontend, `docker-compose.yml` y `railway.toml`.
2. Mapea todos los endpoints de `backend/src/routes/` y qué middleware de autenticación/autorización usa cada uno. Construye una tabla endpoint → método → roles permitidos.
3. Instala dependencias y verifica que la app compila: `npm install` en raíz/backend/frontend, `cd frontend && npm run build`, y arranque del backend. Si algo no compila de entrada, corrígelo primero.
4. Ejecuta `npm audit` en backend y frontend y registra las vulnerabilidades de dependencias.

### FASE 1 — Auditoría de ciberseguridad (prioridad máxima)

Revisa exhaustivamente y corrige, con esta lista mínima (no exclusiva):

**Autenticación y sesiones**
- Secreto JWT: que no exista un valor por defecto hardcodeado ni un fallback débil si falta la variable de entorno; que el algoritmo esté fijado y el token expire.
- Hash de contraseñas con bcrypt/argon2 y factor de costo adecuado; que ninguna ruta devuelva el hash ni la contraseña en las respuestas JSON (revisa los `include`/`attributes` de Sequelize en TODAS las rutas).
- Endpoint de login: mensajes de error que no revelen si el correo existe; protección contra fuerza bruta (rate limiting con `express-rate-limit` al menos en `/api/auth/*`).
- `PUT /api/auth/password`: que exija la contraseña actual y valide longitud/complejidad mínima.
- Restablecimiento de contraseña y envío de credenciales por correo: que las credenciales temporales sean aleatorias y de un solo uso.

**Autorización (la parte más crítica de esta app)**
- Verifica ruta por ruta que exista control de acceso a nivel de objeto (IDOR): un usuario NO debe poder leer/editar/borrar registros de kilometraje, facturas, anticipos, legalizaciones, viajes o notificaciones de otro usuario manipulando el `:id`.
- Verifica que las rutas de aprobación implementen realmente el flujo jerárquico descrito arriba y que sea imposible auto-aprobarse, saltarse un nivel o aprobar fuera de la línea propia (ventas vs. AVEVA) llamando la API directamente.
- Rutas de administración (`users`, `config`, `accounting`, `clients`, `establishments`, `email`): confirma que exigen rol admin/autorizado y no solo un token válido.
- Que el estado "enviado/bloqueado" de una legalización se haga cumplir en el backend (no solo ocultando botones en el frontend): intentos de editar un registro enviado deben rechazarse con 403/409.

**Entradas y datos**
- Inyección SQL: busca cualquier uso de `sequelize.query`, `literal`, `where` construidos por concatenación o interpolación de parámetros del request y parametrízalos.
- Validación de entrada en todos los POST/PUT (tipos, rangos, fechas, valores monetarios no negativos, enums de estado): agrega validación explícita (p. ej. express-validator o validación manual consistente) donde falte.
- Subida de archivos (`upload.js` y rutas `/upload/:field`): lista blanca de MIME/extensiones (solo imágenes/PDF), límite de tamaño, nombre de archivo regenerado en el servidor (nunca el original del cliente), sin path traversal en `:field` ni en la ruta de guardado, y que los archivos servidos exijan autenticación y autorización del dueño (que `/uploads` no sea un directorio estático público con nombres adivinables).
- OCR (`POST /api/expenses/ocr`): que la clave de la API de Claude esté solo en variables de entorno del servidor, nunca expuesta al frontend, y que el endpoint tenga límites de tamaño y de tasa.

**Configuración y transporte**
- CORS: origen restringido en producción (no `*` con credenciales).
- Cabeceras de seguridad con `helmet`; desactivar `x-powered-by`.
- Que no haya secretos en el repo (busca en el historial y en el código claves API, contraseñas SMTP, URLs de base de datos con credenciales); que exista `.env.example` sin valores reales y que `.env` esté en `.gitignore`.
- Manejo de errores: ningún stack trace ni error crudo de Sequelize hacia el cliente en producción; logging del lado del servidor.
- Frontend: XSS (busca `dangerouslySetInnerHTML` y renderizado de datos sin escape), almacenamiento del token (documenta el riesgo si está en localStorage), y que ninguna URL de API tenga credenciales embebidas.
- Dependencias: corrige lo que reporte `npm audit` sin romper compatibilidad (actualizaciones menores/parche; las mayores solo si son necesarias y verificas que todo sigue funcionando).

### FASE 2 — Auditoría funcional

- **Reglas de negocio:** verifica en el código que cada regla de la lista de arriba esté implementada en el backend (no solo en la UI): plazos de entrega (5 días / 3 días), tarifas desde `system_config`, fotos obligatorias, bloqueo tras envío, flujo de autorización de modificación. Corrige discrepancias.
- **Cálculos monetarios:** revisa redondeos y precisión (evita aritmética flotante acumulada en totales; usa DECIMAL en la BD y redondeo consistente a 2 decimales). Verifica que los totales del Excel (`excelGenerator.js`) y del plano NetSuite (`netsuiteFlat.js`) cuadren con los datos.
- **Fechas y zona horaria:** la app opera en Colombia (UTC-5). Revisa `utils/dates.js` y todos los cálculos de plazos para que un registro hecho en la noche no caiga en el día equivocado por conversión UTC.
- **Estados y transiciones:** dibuja el diagrama de estados de legalizaciones/reportes y verifica que el backend rechace transiciones inválidas y condiciones de carrera (p. ej. doble envío o doble aprobación simultánea del mismo reporte).
- **Manejo de errores en frontend:** cada llamada Axios debe manejar el fallo (mensaje al usuario, no pantalla rota ni promesa sin catch); estados de carga en botones de envío para evitar dobles clics que dupliquen registros.
- **Consistencia API:** códigos HTTP correctos (400 validación, 401 sin token, 403 sin permiso, 404 no encontrado, 409 conflicto de estado), formato de respuesta uniforme.
- **Integridad de datos:** claves foráneas y restricciones en migraciones (NOT NULL, UNIQUE donde aplique), `onDelete` coherente, transacciones de Sequelize en operaciones multi-tabla (p. ej. enviar reporte + crear notificaciones).
- Si el proyecto no tiene pruebas, crea al menos pruebas de integración (supertest) para: login, IDOR en kilometraje, flujo de aprobación completo, bloqueo tras envío y cálculo de totales. Deben pasar todas al terminar.

### FASE 3 — Auditoría de diseño y UX

- **Responsive:** la app la usan vendedores desde el celular. Verifica cada página en 360px, 768px y 1280px de ancho; corrige desbordes, tablas sin scroll horizontal contenido, botones inalcanzables y menús rotos en `AppLayout`.
- **Accesibilidad:** labels asociados a inputs, contraste AA en textos y botones, foco visible, `alt` en imágenes, navegación por teclado en modales (`AddEntryModal`, `ChangePasswordModal`, `RecorridoModal`), cierre con Escape y trampa de foco.
- **Consistencia visual:** un solo esquema de colores/espaciado/tipografía Tailwind entre páginas; estados vacíos con mensaje útil (no tablas en blanco); mismos componentes de botón/campo en toda la app.
- **Formatos regionales:** COP `$XXX.XXX` con punto de miles, fechas `DD/MM/YYYY`, textos 100% en español colombiano, sin cadenas en inglés residuales visibles al usuario.
- **Retroalimentación:** confirmaciones antes de acciones destructivas (eliminar registro), toasts/mensajes de éxito y error legibles, indicadores de carga en descargas de Excel y OCR (operaciones lentas).
- **Formularios:** validación en línea con mensajes en español, preservar lo digitado tras un error del servidor, deshabilitar el botón mientras se envía.

### Reglas de trabajo

1. **Prioriza:** corrige en orden Crítico (seguridad explotable) → Alto (fallos funcionales/pérdida de datos) → Medio (UX y consistencia) → Bajo (limpieza). No te quedes puliendo estilos si queda un IDOR abierto.
2. **Commits atómicos** con mensajes en español: `fix(seguridad): ...`, `fix(funcional): ...`, `fix(ux): ...`. Un problema (o grupo íntimamente relacionado) por commit.
3. **No rompas nada:** después de cada grupo de cambios ejecuta el build del frontend, arranca el backend y corre las pruebas. Ningún commit puede dejar la app sin compilar.
4. **No cambies reglas de negocio ni el modelo de datos** salvo que sea imprescindible para corregir un fallo; si lo es, hazlo con migración de Sequelize reversible y explícalo.
5. **No subas secretos** ni pongas valores reales en `.env.example`.
6. Si encuentras un problema que no puedes corregir con certeza (falta contexto de negocio), NO lo adivines: documéntalo en el informe como "requiere decisión".

### Entregable final

Al terminar, crea `INFORME_AUDITORIA.md` en la raíz con:

1. **Resumen ejecutivo** (10 líneas máximo, en español, para gerencia no técnica).
2. **Tabla de hallazgos**: ID, severidad (Crítica/Alta/Media/Baja), categoría (Seguridad/Funcional/Diseño), descripción, archivo(s):línea, estado (Corregido / Requiere decisión) y commit que lo corrige.
3. **Cambios de configuración requeridos en el despliegue** (nuevas variables de entorno, rotación de secretos comprometidos, comandos de migración).
4. **Riesgos residuales y recomendaciones** que quedaron fuera del alcance del código (p. ej. HTTPS en Railway, backups de PostgreSQL, rotación de credenciales de los usuarios de prueba).

Termina entregando: el informe, todos los commits en la rama de trabajo, y la confirmación de que build + backend + pruebas pasan.

---

*Fin del prompt.*
