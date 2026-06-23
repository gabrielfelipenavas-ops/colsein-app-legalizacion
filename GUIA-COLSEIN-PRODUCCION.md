# Guía de puesta en producción — App de Legalizaciones COLSEIN

Esta guía explica, paso a paso, lo que el equipo de **COLSEIN** debe configurar para
que la aplicación funcione de forma estable y segura para **hasta 60 usuarios diarios**
(legalizando, subiendo facturas, pidiendo autorizaciones, etc.).

La app ya está desarrollada y se despliega en **Railway** (la plataforma donde corre el
servidor y la base de datos). Lo que sigue es **configuración**, no programación.

> ⏱️ Tiempo estimado: 30–45 minutos.
> 👤 Quién: una persona con acceso de administrador al proyecto en Railway.

---

## Resumen de lo que hay que hacer

| # | Tarea | ¿Por qué? | Prioridad |
|---|-------|-----------|-----------|
| 1 | Crear un **Volumen** persistente y configurar `UPLOAD_DIR` | Si no, **se pierden todas las facturas** subidas en cada actualización | 🔴 CRÍTICO |
| 2 | Configurar las **variables de entorno** (`JWT_SECRET`, `NODE_ENV`, etc.) | Seguridad y funcionamiento correcto | 🔴 CRÍTICO |
| 3 | Activar **backups** de la base de datos | Respaldo ante cualquier problema | 🟠 Importante |
| 4 | Configurar un **dominio propio con HTTPS** | Necesario para instalar la app en celulares | 🟠 Importante |
| 5 | Crear los **usuarios reales** y desactivar los de prueba | Operación diaria | 🟠 Importante |
| 6 | **Instalar la app** en los celulares de los 60 usuarios | Uso diario | 🟢 Final |

---

## Paso 1 — Volumen persistente para las facturas (🔴 CRÍTICO)

**El problema:** Railway usa almacenamiento "efímero". Cada vez que la app se actualiza
o reinicia, **el disco se borra**. Como las fotos de facturas y soportes se guardan en
ese disco, **se perderían todas** en cada actualización. Esto se soluciona con un
*Volumen* (un disco que SÍ se conserva).

**Pasos en Railway:**

1. Entra a [railway.app](https://railway.app) e ingresa al **proyecto de la app**.
2. Haz clic en el **servicio del backend** (el del servidor Node.js).
3. Ve a la pestaña **"Volumes"** (Volúmenes) → botón **"+ New Volume"** / **"Create Volume"**.
4. En **Mount path** (ruta de montaje) escribe exactamente:
   ```
   /data
   ```
5. Guarda. Railway creará el disco persistente.
6. Ahora ve a la pestaña **"Variables"** y agrega esta variable (ver Paso 2 para el resto):
   ```
   UPLOAD_DIR=/data/uploads
   ```
7. Railway redesplegará solo. **Para confirmar que quedó bien**, abre la pestaña
   **"Deployments" → Logs** y busca esta línea al arrancar:
   ```
   📁 Archivos subidos en: /data/uploads
   ```
   Si en su lugar ves un aviso ⚠️ sobre "almacenamiento EFÍMERO", la variable no quedó
   bien configurada.

> 💡 **Importante:** Esto solo protege las facturas **a partir de ahora**. Las que se
> hayan subido antes de configurar el volumen ya no se pueden recuperar.

---

## Paso 2 — Variables de entorno (🔴 CRÍTICO)

Las "variables de entorno" son la configuración del servidor. Se editan en la pestaña
**"Variables"** del servicio del backend en Railway.

### Obligatorias

| Variable | Valor | Para qué sirve |
|----------|-------|----------------|
| `NODE_ENV` | `production` | Activa el modo producción (seguridad y rendimiento) |
| `JWT_SECRET` | *(una clave larga y aleatoria — ver abajo)* | Firma las sesiones de los usuarios. **Debe ser secreta** |
| `UPLOAD_DIR` | `/data/uploads` | Carpeta persistente de archivos (del Paso 1) |
| `DATABASE_URL` | *(la pone Railway automáticamente)* | Conexión a la base de datos |

> **Cómo generar un `JWT_SECRET` seguro:** usa una cadena larga y aleatoria (mínimo 40
> caracteres). Por ejemplo, puedes generar una en [https://generate-secret.vercel.app/40](https://generate-secret.vercel.app/40)
> o pedirle a alguien de sistemas que ejecute `openssl rand -base64 48`. Pégala como
> valor y **no la compartas**.

> ⚠️ Si `NODE_ENV=production` está puesto pero falta un `JWT_SECRET` seguro, **el
> servidor no arrancará** (es una protección de seguridad intencional). Configura ambos.

### Recomendadas (según las funciones que se usen)

| Variable | Valor de ejemplo | Para qué sirve |
|----------|------------------|----------------|
| `APP_URL` | `https://app.colsein.co` | Enlaces en los correos de notificación |
| `FRONTEND_URL` | `https://app.colsein.co` | Seguridad (CORS). Usar el dominio final |
| `JWT_EXPIRES_IN` | `7d` | Duración de la sesión antes de pedir login otra vez |
| `MAX_FILE_SIZE` | `26214400` | Tamaño máximo por archivo (en bytes; 25 MB) |

### Opcionales (funciones avanzadas)

- **OCR de facturas con IA:** `ANTHROPIC_API_KEY` (clave de la API de Claude).
- **Envío de correos (notificaciones):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- **Lectura de facturas desde un correo:** `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`.
- **Cálculo de distancias por carretera:** `ORS_API_KEY` u `OSRM_URL`.
- **Tarifas de kilometraje** (también se configuran desde el panel de Admin):
  `TARIFA_CARRO`, `TARIFA_MOTO`.

> Después de cambiar variables, Railway redesplega automáticamente.

---

## Paso 3 — Backups de la base de datos (🟠 Importante)

Para no perder la información (usuarios, legalizaciones, gastos) ante cualquier
incidente:

1. En el proyecto de Railway, abre el servicio de **PostgreSQL** (la base de datos).
2. Ve a la pestaña **"Backups"**.
3. Activa los **backups automáticos** (Railway permite programar respaldos periódicos).
4. Verifica de vez en cuando que se estén generando.

> 💡 Las migraciones de la base de datos (la estructura de tablas) se ejecutan **solas**
> en cada despliegue, así que el equipo no tiene que hacer nada manual para eso.

---

## Paso 4 — Dominio propio con HTTPS (🟠 Importante)

Para que los usuarios puedan **instalar la app en el celular**, el sitio debe abrirse
por **HTTPS** (candado de seguridad). Railway ya entrega una URL con HTTPS
(`...up.railway.app`), pero lo ideal es un dominio de COLSEIN.

1. En el servicio del backend → pestaña **"Settings" → "Networking" / "Domains"**.
2. Puedes:
   - **Usar el dominio gratis de Railway** (`algo.up.railway.app`) — ya tiene HTTPS, o
   - **Agregar un dominio propio** (ej. `app.colsein.co`): haz clic en **"Custom Domain"**,
     escribe el dominio y Railway te dará un registro **CNAME** que el área de sistemas
     de COLSEIN debe agregar en el proveedor del dominio (donde esté registrado
     `colsein.co`). El certificado HTTPS se genera automáticamente.
3. Cuando el dominio quede activo, actualiza las variables `APP_URL` y `FRONTEND_URL`
   (Paso 2) con esa dirección.

---

## Paso 5 — Crear los usuarios reales (🟠 Importante)

La app trae unos usuarios de **prueba**. En producción hay que crear los usuarios reales
de COLSEIN y desactivar los de prueba.

1. Ingresa con una cuenta de **administrador** (o **presidente** / **gerente general**,
   que también pueden gestionar usuarios).
2. Ve a la sección **"Usuarios"** (abajo en el menú).
3. Crea cada uno de los usuarios reales: nombre, cédula, correo, contraseña, **rol**
   (Comercial, Líder Regional, Gerente, etc.), zona y vehículo si aplica.
4. **Desactiva o cambia la contraseña** de los usuarios de prueba que vienen por defecto.

> Si la base de datos está **vacía** (sin ningún usuario para entrar la primera vez), el
> área de sistemas puede cargar los datos iniciales ejecutando una sola vez, desde la
> consola del proyecto en Railway:
> ```
> cd backend && npx sequelize-cli db:seed:all
> ```
> Esto crea un administrador inicial con el que se puede entrar y luego crear los
> usuarios reales. **Cambia esa contraseña de inmediato.**

---

## Paso 6 — Instalar la app en los celulares (🟢 Final)

La app es una **PWA**: se instala desde el navegador, sin tiendas ni cuentas de pago.
Cada uno de los 60 usuarios hace esto **una vez** en su celular, usando la **URL final**
de la app (Paso 4):

**En Android (Chrome):**
1. Abrir la URL en **Chrome**.
2. Tocar el menú **⋮** (arriba a la derecha).
3. Tocar **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**.

**En iPhone (Safari):**
1. Abrir la URL en **Safari** (debe ser Safari, no Chrome).
2. Tocar el botón **Compartir** (cuadro con flecha hacia arriba).
3. Tocar **"Agregar a pantalla de inicio"**.

Queda un ícono con el logo de **Legalizaciones** y abre a pantalla completa, como una app
normal.

> 💡 **Si alguien ya tenía instalada una versión vieja** (con el ícono de la "C"): debe
> **eliminar** ese ícono y volver a agregarlo desde el navegador, porque el celular
> guarda la versión anterior en caché.

---

## Verificación final (checklist)

- [ ] Volumen creado en `/data` y `UPLOAD_DIR=/data/uploads` configurado.
- [ ] En los logs aparece `📁 Archivos subidos en: /data/uploads`.
- [ ] `NODE_ENV=production` y un `JWT_SECRET` seguro configurados.
- [ ] La app abre por HTTPS (dominio de Railway o propio).
- [ ] Backups de la base de datos activados.
- [ ] Usuarios reales creados; usuarios de prueba desactivados.
- [ ] Prueba completa: iniciar sesión, subir una factura, cerrar y volver a entrar y
      confirmar que la factura **sigue ahí** (esto valida que el volumen funciona).
- [ ] App instalada en los celulares de los usuarios.

---

## Mantenimiento y notas

- **Capacidad:** 60 usuarios diarios es una carga holgada para la app. La base de datos
  está configurada para atender la concurrencia esperada sin problemas.
- **Actualizaciones:** cada cambio que se suba al repositorio de GitHub se despliega
  automáticamente en Railway. Las facturas y los datos **se conservan** gracias al
  volumen y la base de datos persistentes.
- **Almacenamiento:** con 60 personas subiendo fotos a diario, el espacio del volumen
  crecerá con el tiempo. Conviene revisar el uso cada cierto tiempo y ampliarlo si hace
  falta. (Opcional: se puede activar compresión automática de imágenes para que ocupen
  mucho menos — consultar al desarrollador.)
- **Soporte:** ante errores en producción, revisar siempre primero los **Logs** del
  servicio en Railway (pestaña "Deployments" → "Logs"), donde aparecen los mensajes de
  error con detalle.
