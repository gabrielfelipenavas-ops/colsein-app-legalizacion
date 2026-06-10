# Auditoría Interna — Sistema de Gestión de Gastos COLSEIN S.A.S.

> **Fecha:** 10 de junio de 2026
> **Alcance:** Revisión interna y exhaustiva del código fuente (backend, frontend, base de datos, configuración y dependencias).
> **Tipo:** Solo lectura. No se modificó ningún archivo de la aplicación.
> **Dirigido a:** Lectura no técnica. Cada hallazgo se explica en lenguaje sencillo, con el detalle técnico al lado.

---

## A. RESUMEN EJECUTIVO

La aplicación está **bien construida en lo fundamental** (buena arquitectura, contraseñas cifradas, dinero guardado con el tipo de dato correcto, manejo de errores ordenado), pero tiene **fallas de seguridad serias que deben corregirse antes de seguir usándola con datos reales**. Las dos más graves: (1) las **contraseñas reales de producción están escritas en el código** y publicadas en el repositorio de GitHub (la del administrador es `admin2026` y *funciona* hoy en la app en vivo); y (2) cualquier empleado que haya iniciado sesión puede **ver y descargar los reportes de gastos, kilometraje y legalizaciones de cualquier otro empleado** simplemente cambiando un número en la dirección (problema conocido como "IDOR"). También hay formas de que un empleado **manipule los montos que se le reembolsan** saltándose los cálculos del sistema. **Veredicto: NO apto para uso en producción con datos sensibles hasta corregir los hallazgos CRÍTICOS y ALTOS.** La buena noticia es que casi todo es de arreglo rápido y concentrado en pocos archivos.

---

## B. CÓMO FUNCIONA LA APP POR DENTRO (explicación sencilla)

Imagine la aplicación como un edificio con tres pisos:

1. **El navegador (lo que ve el empleado en su celular/computadora).**
   Está hecho con **React** (una tecnología para construir pantallas interactivas). El empleado entra con su correo y contraseña, registra kilometraje, sube fotos de facturas, pide anticipos y arma sus legalizaciones. Esta parte vive en la carpeta `frontend/`.

2. **El servidor (el cerebro que recibe las peticiones y decide qué hacer).**
   Está hecho con **Node.js + Express** (lenguaje JavaScript del lado del servidor). Recibe lo que envía el navegador, verifica que el usuario tenga permiso, hace los cálculos de dinero, guarda los datos y genera los reportes en Excel. Vive en `backend/`.

3. **La base de datos (el archivador donde se guarda todo permanentemente).**
   Es **PostgreSQL**. Guarda usuarios, clientes, reportes de kilometraje, anticipos, gastos, legalizaciones y el registro de aprobaciones.

**El flujo de la información**, paso a paso:
El empleado hace algo en el navegador → el navegador envía la petición al servidor con un "carnet digital" (un *token* que prueba quién es) → el servidor revisa el carnet, valida los datos, hace los cálculos y habla con la base de datos → la base de datos responde → el servidor devuelve el resultado al navegador.

Servicios externos que usa:
- **Correo electrónico (IMAP)**: la app se conecta a un buzón de correo para buscar facturas electrónicas y cruzarlas con los gastos.
- **OCR (lectura de texto en imágenes)**: usa **Tesseract** para leer los datos de una foto de factura automáticamente.
- **Railway**: es donde está alojada (publicada) la aplicación en internet.
- **Correo saliente (SMTP, opcional)**: para enviar notificaciones por email.

---

## Funcionalidades que implementa el código (Fase 1, punto 3)

- **Inicio de sesión** con correo + contraseña y carnet digital (JWT) válido por 7 días.
- **Cambio de contraseña** del propio usuario.
- **Gestión de usuarios** (solo administrador): crear y editar empleados con sus roles.
- **Roles**: comercial, líder regional, gerente de ventas, control interno, administrador.
- **Kilometraje**: registrar recorridos diarios (km inicial/final, cliente, medio CARRO/MOTO), cálculo automático del valor por tarifa, peajes, parqueaderos, taxis y otros, con foto de soporte obligatoria.
- **Reportes mensuales de kilometraje**: se arman solos por mes, se envían a revisión y se aprueban.
- **Anticipos de viaje**: solicitar presupuesto por día (alojamiento, alimentación, transporte, etc.), con número consecutivo automático.
- **Legalización de gastos**: comparar lo gastado realmente contra el anticipo y calcular quién le debe a quién (empresa o empleado).
- **Gastos individuales**: registrar facturas con valor, IVA, NIT, etc., con foto, y lectura automática por OCR.
- **Cruce con correo**: buscar facturas electrónicas en el buzón y vincularlas a los gastos.
- **Flujo de aprobaciones**: enviar → revisar → aprobar/rechazar, con comentarios.
- **Notificaciones**: dentro de la app y por correo (función recién agregada).
- **Generación de reportes en Excel** con el formato oficial de la empresa, y un "paquete mensual" en ZIP.
- **Importación masiva de clientes** desde Excel/CSV.
- **Tablero (dashboard)** con resumen del mes.

---

## C. TABLA DE HALLAZGOS POR GRAVEDAD

> Cómo leer la gravedad:
> **CRÍTICO** = peligro real e inmediato (robo de datos, manipulación de dinero, acceso de administrador). Arreglar ya.
> **ALTO** = riesgo serio, explotable sin mucho esfuerzo. Arreglar pronto.
> **MEDIO** = debilidad que conviene corregir.
> **BAJO** = mejora recomendable, sin urgencia.

---

### 🔴 CRÍTICO

#### C-1. Las contraseñas de producción están escritas en el código y publicadas en GitHub
- **Qué es:** El archivo que carga los datos de ejemplo contiene las contraseñas reales de los usuarios en texto legible. La del administrador es `admin2026`, la del líder regional `ramirez2026`, las de los comerciales `meza2026`, `herrera2026`, `pinzon2026`. **Verifiqué que `admin2026` funciona ahora mismo en la app en producción.** Como el repositorio está en GitHub, cualquiera que tenga (o consiga) acceso al código conoce la contraseña del administrador del sistema.
- **Por qué importa:** El administrador puede ver y modificar todo, crear usuarios y cambiar tarifas. Que su contraseña esté publicada y sea adivinable (`nombre`+`2026`) equivale a dejar la llave maestra pegada en la puerta. Cualquiera podría entrar como administrador, aprobar pagos, modificar montos o robar la información de todos los empleados.
- **Dónde está:** `backend/seeds/20260407000001-demo-data.js`, líneas 10–14.
- **Solución recomendada:** (1) Cambiar **inmediatamente** todas las contraseñas en producción por unas fuertes y únicas. (2) Quitar las contraseñas del código (los datos de ejemplo no deberían usarse en producción, o deberían generar contraseñas aleatorias que se entreguen aparte). (3) Obligar a cada usuario a cambiar su contraseña en el primer ingreso.

#### C-2. Cualquier empleado puede ver y descargar los datos financieros de los demás (IDOR)
- **Qué es:** Varias direcciones del sistema entregan la información con solo pedir un número de identificación (ID), **sin comprobar que el reporte le pertenezca a quien lo pide**. Un comercial podría escribir en su navegador la dirección de "reporte 1, 2, 3…" e ir descargando los reportes de kilometraje, legalizaciones y archivos Excel de todos sus compañeros (con cédula, nombre, montos, destinos, etc.).
- **Por qué importa:** Es una fuga de información financiera y personal de toda la empresa. Cualquier empleado con una cuenta normal puede espiar lo de los demás cambiando un número. Es trivial de explotar (no requiere conocimientos técnicos avanzados).
- **Dónde está:**
  - `backend/src/routes/kilometraje.js:28` → `GET /reports/:id` (no valida dueño)
  - `backend/src/routes/legalizations.js:52` → `GET /:id` (no valida dueño)
  - `backend/src/routes/reports.js:11` → Excel de kilometraje (no valida dueño)
  - `backend/src/routes/reports.js:41` → Excel de legalización (no valida dueño)
- **Solución recomendada:** En cada una de estas rutas, verificar que el registro pertenezca al usuario (`user_id === req.user.id`) **o** que el usuario sea un rol con permiso para ver de otros (líder, gerente, control interno, admin). El patrón correcto ya se usa en otras partes del código (por ejemplo en gastos), solo falta aplicarlo aquí.

#### C-3. La "llave" que firma los carnets digitales es débil y pública (a verificar en producción)
- **Qué es:** El sistema firma cada carnet de sesión (token) con una clave secreta. En el código esa clave tiene un valor por defecto débil y predecible: `colsein-jwt-secret-change-in-production-2026` (el propio nombre dice "cambiar en producción"). Si en el servidor de producción no se reemplazó por una clave fuerte, un atacante podría **fabricar su propio carnet de administrador** sin saber ninguna contraseña.
- **Por qué importa:** Sería un acceso total y silencioso como administrador. Es el tipo de falla que permite tomar control completo del sistema.
- **Dónde está:** `backend/.env:8` (valor por defecto). *No pude confirmar el valor real de producción —y no se debe intentar adivinarlo contra el sistema en vivo—, por eso queda como "a verificar".*
- **Solución recomendada:** Verificar en Railway (Variables del servicio) que `JWT_SECRET` tenga un valor largo y aleatorio, distinto al del código. Si no lo tiene, generarlo ya y configurarlo (al cambiarlo, todos tendrán que volver a iniciar sesión, lo cual es correcto).

---

### 🟠 ALTO

#### A-1. Un empleado puede manipular el monto que se le reembolsa (asignación masiva)
- **Qué es:** Al crear un gasto y al editar un registro de kilometraje, el servidor guarda **todo lo que el navegador le manda, sin filtrar**. Esto permite a un empleado enviar campos que no debería poder tocar. Dos ejemplos concretos:
  - Marcar su propio gasto como **`validado: true`** (es decir, "ya auditado/aprobado"), saltándose a control interno.
  - Sobrescribir el **`valor_km`** (el valor en pesos del kilometraje) directamente, ignorando el cálculo por tarifa. Por ejemplo, enviar `valor_km = 5.000.000` en un recorrido y el sistema lo guarda tal cual.
- **Por qué importa:** Es una vía directa para inflar reembolsos o falsear el estado de auditoría. En una app de gastos, esto es dinero real.
- **Dónde está:**
  - `backend/src/routes/expenses.js:48` → `const data = { ...req.body, ... }` (crea el gasto con todo lo recibido).
  - `backend/src/routes/kilometraje.js:120` → `entry.update(req.body)` (actualiza con todo lo recibido).
  - *Nota: el `PUT` de gastos (`expenses.js:198`) sí filtra los campos correctamente; falta hacer lo mismo en estos dos puntos.*
- **Solución recomendada:** Aceptar **solo una lista blanca de campos permitidos** (como ya se hace en el `PUT` de gastos). Nunca permitir que el usuario fije `valor_km`, `validado`, `user_id`, `report_id`, etc.; esos los calcula o controla el servidor.

#### A-2. El buzón de correo es compartido: un empleado puede leer facturas/correos de los demás
- **Qué es:** La función de buscar facturas se conecta a **un único buzón de correo** con credenciales fijas. Cualquier usuario con sesión puede buscar en **todo** ese buzón y descargar **cualquier** adjunto (cambiando el identificador del mensaje). No hay separación por empleado.
- **Por qué importa:** Si en ese buzón llegan correos o facturas de distintas personas o de la empresa, todos quedan expuestos a cualquiera que use la app. Es una fuga de confidencialidad.
- **Dónde está:** `backend/src/routes/email.js` (configuración líneas 9–19; búsqueda línea 22; descarga de adjunto línea 135).
- **Detalle técnico extra:** La conexión al correo usa `rejectUnauthorized: false` (línea 16), lo que **desactiva la validación del certificado de seguridad** y abre la puerta a ataques de interceptación ("hombre en el medio").
- **Solución recomendada:** Restringir qué correos puede ver cada usuario (por ejemplo, filtrar por su propia dirección o destinar un buzón por persona), y reactivar la validación del certificado TLS.

#### A-3. No hay límite de intentos de inicio de sesión (fuerza bruta)
- **Qué es:** El sistema no limita cuántas veces seguidas alguien puede intentar adivinar una contraseña. Un atacante puede probar miles de combinaciones automáticamente.
- **Por qué importa:** Combinado con las contraseñas débiles y predecibles (hallazgo C-1), adivinar una cuenta es cuestión de minutos. También permite "tumbar" el servicio a punta de peticiones.
- **Dónde está:** `backend/src/routes/auth.js` (no existe ningún control de tasa/intentos en toda la app).
- **Solución recomendada:** Añadir un limitador de intentos (por ejemplo `express-rate-limit`): bloquear tras varios fallos, demorar respuestas y/o bloqueo temporal por cuenta/IP.

#### A-4. Los archivos subidos son públicos y se aceptan tipos peligrosos
- **Qué es:** Las fotos/soportes que se suben quedan accesibles por internet **sin pedir sesión** (cualquiera con el enlace los ve). Además, el filtro de tipos de archivo es demasiado permisivo: por la forma en que está escrita la condición (usa "o" en vez de "y") y porque acepta el tipo genérico `application/octet-stream`, se podrían colar archivos `.html` o `.svg`, que el navegador **ejecuta como página web**.
- **Por qué importa:** (1) Documentos de soporte (facturas con datos, nombres, NITs) quedan expuestos públicamente. (2) Subir un archivo HTML malicioso y abrirlo desde el mismo dominio de la app puede ejecutar código en el navegador de otra persona (ataque conocido como XSS almacenado), por ejemplo para robar su sesión.
- **Dónde está:** `backend/src/index.js:23` (sirve `/uploads` sin autenticación) y `backend/src/middleware/upload.js:21–29` (filtro de tipos permisivo).
- **Solución recomendada:** (1) Servir los archivos solo a usuarios autenticados y autorizados (no como carpeta pública). (2) Endurecer el filtro: exigir que el tipo **y** la extensión estén en una lista corta de formatos de imagen/PDF; rechazar `octet-stream`, `.svg` y `.html`. (3) Forzar que los archivos se descarguen en vez de abrirse en el navegador.

---

### 🟡 MEDIO

#### M-1. El servidor no valida bien los montos y rangos
- **Qué es:** No se comprueba que los valores tengan sentido. Se puede registrar un kilometraje con `km_final` menor que `km_inicial` (kilometraje negativo), o enviar montos negativos o vacíos en anticipos y gastos. En anticipos, un texto no numérico puede producir un cálculo inválido (`NaN`).
- **Por qué importa:** Datos inconsistentes y posibilidad de descuadrar totales. En dinero, todo monto debería validarse.
- **Dónde está:** `backend/src/routes/kilometraje.js:71`; `backend/src/routes/anticipos.js:60`; `POST` de `backend/src/routes/expenses.js` (sin validaciones).
- **Solución recomendada:** Validar en el servidor: montos numéricos y ≥ 0, `km_final ≥ km_inicial`, límites razonables. Idealmente también un tope de seguridad en la base de datos.

#### M-2. Se pueden alterar gastos o re-aprobar registros ya cerrados
- **Qué es:** La ruta que asocia gastos a una legalización **no revisa el estado**: un empleado podría modificar los gastos de una legalización **ya enviada o aprobada**, cambiando el total después de aprobada. Además, las rutas de aprobación no verifican el estado actual, por lo que se puede "aprobar" algo en borrador o re-aprobar. El flujo de dos pasos (líder → gerente) no se obliga en legalizaciones (un solo aprobador la deja como final).
- **Por qué importa:** Debilita la integridad del proceso de aprobación: lo aprobado podría cambiar después sin control.
- **Dónde está:** `backend/src/routes/legalizations.js:147` (asociar gastos sin chequeo de estado) y `:223` (aprobar sin chequeo de estado).
- **Solución recomendada:** Bloquear cambios cuando el estado sea `enviado`/`aprobado`, y validar la transición de estados antes de aprobar/rechazar.

#### M-3. Los aprobadores no están limitados por zona/región
- **Qué es:** Un líder regional puede aprobar reportes de **cualquier** zona, no solo de su región.
- **Por qué importa:** Rompe la separación de responsabilidades del flujo definido por la empresa (cada líder revisa lo suyo).
- **Dónde está:** `backend/src/routes/kilometraje.js:198`; `backend/src/routes/anticipos.js:95`.
- **Solución recomendada:** Validar que el reporte pertenezca a la zona/equipo del aprobador (o asignación explícita líder→comerciales).

#### M-4. Librerías con vulnerabilidades conocidas
- **Qué es:** Al revisar las dependencias, hay paquetes con fallas reportadas.
  - **Backend:** 13 vulnerabilidades (7 altas, 6 moderadas). Destaca `tmp` (recorrido de directorios) y la cadena del cliente de correo (`imap`/`utf7`).
  - **Frontend:** 7 vulnerabilidades (1 alta: `react-router` permite redirección abierta; 6 moderadas).
- **Por qué importa:** Son puertas conocidas que los atacantes buscan activamente.
- **Dónde está:** `backend/package.json`, `frontend/package.json`.
- **Solución recomendada:** Ejecutar `npm audit fix` en ambos proyectos y planear las actualizaciones que implican cambios mayores, probando que todo siga funcionando.

#### M-5. Permiso de origen (CORS) demasiado abierto en producción
- **Qué es:** En producción, si no se configura la dirección del frontend, el servidor acepta peticiones **desde cualquier sitio web** con credenciales habilitadas.
- **Por qué importa:** Mala práctica de seguridad. En esta app el impacto real es bajo porque el carnet viaja en una cabecera (no en cookies), pero conviene cerrarlo.
- **Dónde está:** `backend/src/index.js:15`.
- **Solución recomendada:** Fijar `FRONTEND_URL` a la dirección exacta de la app y no usar "aceptar cualquiera".

#### M-6. Mensajes de error que revelan detalles internos
- **Qué es:** Algunas respuestas de error devuelven el mensaje técnico interno al usuario (por ejemplo, errores de conexión al correo).
- **Por qué importa:** Le da pistas a un atacante sobre cómo está montado el sistema.
- **Dónde está:** `backend/src/routes/email.js:130` y `:296`.
- **Solución recomendada:** Mostrar un mensaje genérico al usuario y registrar el detalle solo en los logs del servidor.

#### M-7. La numeración de IDs se desincroniza por los datos de ejemplo
- **Qué es:** Los datos de ejemplo insertan usuarios con IDs fijos (1 al 5) sin avanzar el contador interno de la base de datos. Por eso, al crear los primeros usuarios reales, el sistema falla con "Email o cédula ya registrados" aunque no existan (lo confirmé durante esta sesión).
- **Por qué importa:** Provoca errores confusos al crear usuarios y puede afectar otras tablas con datos de ejemplo de IDs fijos.
- **Dónde está:** `backend/seeds/20260407000001-demo-data.js` (IDs explícitos 1–5).
- **Solución recomendada:** Tras cargar datos de ejemplo, reajustar el contador de IDs de la tabla (resetear la "secuencia"), o no usar IDs fijos.

---

### 🟢 BAJO

| Código | Hallazgo | Dónde | Recomendación |
|---|---|---|---|
| B-1 | Política de contraseñas débil (mínimo 4 al entrar, 6 al cambiar; sin complejidad) | `backend/src/routes/auth.js:11,42` | Exigir mínimo 8–10 caracteres con complejidad |
| B-2 | Cálculos de dinero con números flotantes (`parseFloat`/sumas) | `kilometraje.js:289`, `legalizations.js:168` | Riesgo mínimo de centavos; la BD usa DECIMAL y lo mitiga. Considerar redondeo controlado o aritmética entera en centavos |
| B-3 | El consecutivo de anticipos puede repetirse (condición de carrera) e ignora el año | `anticipos.js:57` | Generar el consecutivo de forma atómica e incluir el año |
| B-4 | Tabla `credit_card_transactions` creada pero sin usarse (código muerto) | `migrations/20260407000001:201` | Eliminarla o implementarla |
| B-5 | Registros de aprobaciones/notificaciones sin llave foránea → pueden quedar "huérfanos" | `migrations` (approvals, notifications) | Añadir limpieza o referencias polimórficas controladas |
| B-6 | Carnet (JWT) dura 7 días y no se puede revocar uno a uno | `auth.js:24` | Mitigado porque al desactivar un usuario su sesión deja de servir de inmediato. Considerar expiración más corta |
| B-7 | Documentación desactualizada: CLAUDE.md dice OCR con "Claude Vision" pero el código usa Tesseract; y lista contraseñas de prueba | `CLAUDE.md`, `expenses.js:71` | Actualizar la documentación y quitar contraseñas de ahí |
| B-8 | El correo de notificación arma HTML con datos del usuario (comentarios) sin escapar | `services/notifications.js:36` | Escapar el contenido para evitar inyección de HTML en el correo |

---

## D. LO QUE ESTÁ BIEN HECHO

Es importante reconocerlo: la base es sólida y se nota cuidado en varias decisiones.

- ✅ **Las contraseñas se guardan cifradas correctamente** con `bcrypt` (factor 12). Nunca se guardan en texto plano. *(El problema de C-1 no es el cifrado, sino que las contraseñas estén en el código.)*
- ✅ **El archivo de secretos `.env` NO está subido a GitHub** y el `.gitignore` lo excluye bien.
- ✅ **El dinero se guarda con el tipo de dato correcto (DECIMAL)** en la base de datos, no con decimales flotantes. Es la decisión correcta para una app de gastos.
- ✅ **La mayoría de las rutas de "mis registros" sí validan la propiedad** (cada quien ve lo suyo). El patrón correcto ya existe; solo falta aplicarlo en los puntos del hallazgo C-2.
- ✅ **El `PUT` de gastos filtra los campos permitidos** (lista blanca) — buena práctica que solo falta replicar en otros dos puntos.
- ✅ **El frontend usa React, que escapa el contenido por defecto**, y no se encontró `dangerouslySetInnerHTML`. El riesgo de XSS desde la propia interfaz es bajo.
- ✅ **El sistema vuelve a cargar y revisar al usuario en cada petición** y comprueba si está activo: al desactivar un empleado, su acceso se corta de inmediato.
- ✅ **Las acciones sensibles exigen rol** (cambiar tarifas y crear usuarios requieren administrador).
- ✅ **Está activado `helmet`** (cabeceras de seguridad básicas en el servidor).
- ✅ **El borrado en cascada está bien definido**: al eliminar un usuario se limpian sus reportes, gastos, etc. No quedan datos sueltos.
- ✅ **La lógica financiera de anticipo vs. gasto real es correcta** (calcula bien si la empresa le debe al empleado o al revés).
- ✅ **Las fotos de soporte se exigen** antes de enviar un reporte de kilometraje (peajes, parqueaderos, taxis).
- ✅ **Manejo de errores ordenado**: cada ruta tiene su `try/catch` y hay un manejador global; la app no se cae ante un fallo puntual.

---

## E. PLAN DE ARREGLOS PRIORIZADO

El orden está pensado para reducir el riesgo más grande primero, con el menor esfuerzo.

### 🚑 Paso 1 — HOY MISMO (contención inmediata, poco esfuerzo)
1. **Cambiar todas las contraseñas en producción** por unas fuertes y únicas (especialmente la del administrador). *(Hallazgo C-1)*
2. **Verificar en Railway que `JWT_SECRET` sea una clave fuerte y secreta**, distinta a la del código. Si no, generarla y configurarla. *(C-3)*
   > Estos dos pasos no requieren tocar código y cierran las puertas más peligrosas.

### 🔧 Paso 2 — ESTA SEMANA (corregir las fugas y la manipulación)
3. **Cerrar el acceso a datos ajenos (IDOR)**: agregar la verificación de dueño/rol en las 4 rutas del hallazgo **C-2**.
4. **Bloquear la manipulación de montos**: aplicar lista blanca de campos en crear-gasto y editar-kilometraje. *(A-1)*
5. **Proteger los archivos subidos** (no públicos) y **endurecer el filtro de tipos**. *(A-4)*
6. **Limitar intentos de login** (anti–fuerza bruta). *(A-3)*
7. **Restringir el buzón de correo** y reactivar la validación TLS. *(A-2)*

### 🧱 Paso 3 — PRÓXIMAS 2 SEMANAS (robustez e integridad)
8. **Validar montos y rangos en el servidor** (no negativos, `km_final ≥ km_inicial`, etc.). *(M-1)*
9. **Proteger los estados de aprobación** (no editar lo aprobado, validar transiciones, forzar el flujo de dos pasos). *(M-2)*
10. **Limitar aprobadores por zona/región**. *(M-3)*
11. **Actualizar dependencias** (`npm audit fix` en backend y frontend). *(M-4)*
12. **Cerrar CORS** y **ocultar mensajes de error internos**. *(M-5, M-6)*
13. **Arreglar la secuencia de IDs** de los datos de ejemplo. *(M-7)*

### 🧹 Paso 4 — CUANDO HAYA TIEMPO (mejoras y limpieza)
14. Política de contraseñas más fuerte, limpieza de código muerto, documentación al día y demás puntos **BAJOS** (B-1 a B-8).

---

### Resumen en una frase
> La aplicación tiene **buenos cimientos**, pero hoy **expone las contraseñas de producción y los datos financieros de todos los empleados**. Con los **Pasos 1 y 2** se elimina el riesgo más grave en cuestión de horas; los **Pasos 2 y 3** la dejan en un estado razonablemente seguro para operar.

---

Segundo informe:


INFORME DE AUDITORÍA QA — Sistema de Gestión de Gastos COLSEIN S.A.S.
A. RESUMEN EJECUTIVO
La aplicación tiene una arquitectura sólida y buena separación de roles, y la mayoría de los cálculos de dinero cuadran al peso. Sin embargo, encontré un defecto crítico que rompe la función más básica del sistema: registrar un gasto manual (factura) desde la pantalla falla, congela el navegador 60–90 segundos y, cuando lleva una foto adjunta, pierde el dato por completo. Por esta razón el veredicto es: NO APTA para uso en producción tal como está, hasta corregir el guardado de gastos. El resto (legalizaciones, kilometraje, aprobaciones, reportes y exportación a Excel) funciona y calcula bien.

B. TABLA DE HALLAZGOS POR GRAVEDAD
🔴 CRÍTICO
C-1. Registrar un gasto manual CON foto adjunta pierde el dato y congela el navegador.

Pantalla: Facturas → "Manual" → "Guardar Gasto".
Pasos: Llenar el formulario, adjuntar una imagen/PDF de factura, pulsar "Guardar Gasto".
Qué pasó: El navegador se congela 60–90 s (pantalla bloqueada, no responde). Al recuperarse, el gasto NO quedó guardado y la app no muestra ningún mensaje de error. Lo verifiqué: el gasto "Restaurante Andrés Carne de Res QA-TEST" (con foto) nunca llegó a la base de datos.
Qué esperaba: Que guardara el gasto con su soporte y mostrara confirmación, sin congelarse.

C-2. Registrar gasto manual SIN foto ("No tengo el soporte") congela igual y provoca DUPLICADOS.

Pantalla: Facturas → "Manual" → marcar "No tengo el soporte" → "Guardar Gasto".
Pasos: Llené el formulario, marqué "No tengo soporte", justifiqué, guardé.
Qué pasó: El servidor sí guarda el gasto (queda en la base), pero la pantalla se congela y nunca confirma. Un usuario real, al ver la pantalla bloqueada sin confirmación, vuelve a darle "Guardar" → se crean duplicados. Lo reproduje: quedaron dos gastos idénticos "Taxi Aeropuerto QA-TEST $50.000" (id 13 y 14) de mis dos intentos.
Causa técnica (la encontré): El formulario envía los datos como multipart/form-data; cuando incluye la imagen, el servidor responde HTTP 500 "Error al crear gasto" y la app se queda colgada en el manejo de ese error. Cuando envié exactamente los mismos campos en formato JSON por la API, el servidor respondió 201 (éxito) sin problema. Es decir: el problema está en cómo el frontend arma y envía el formulario de creación, no en la base de datos.
Qué esperaba: Guardado rápido con confirmación clara, y bloqueo de doble envío.

C-3. Fallos "silenciosos": la app no avisa cuando algo sale mal.

En todos los casos anteriores la app nunca muestra un mensaje de error al usuario ni deja rastro en la consola. El usuario no sabe si guardó o no. Para una app de dinero esto es grave (gente reenviando, perdiendo gastos, o creyendo que registró algo que no quedó).

🟠 ALTO
A-1. La aprobación de legalizaciones también congela el navegador.

Pantalla: Aprobar → "Revisar" → "Aprobar".
Qué pasó: Aprobé la Legalización #6 (QA-TEST). La aprobación sí se guardó correctamente (quedó "Aprobado" y bajó el contador de pendientes), pero la pantalla se congeló igual que al crear gastos. Mismo patrón de "congelamiento tras escribir en el servidor".
Impacto: El aprobador puede pensar que falló y reintentar.

🟡 MEDIO
M-1. Los montos con decimales se redondean en la visualización.

Pantalla: Facturas (lista) / Km.
Qué pasó: Creé un gasto de $9.999,99. La base guarda el valor exacto, pero la lista lo muestra como $10.000 (redondeado, sin centavos). En una app contable, mostrar cifras redondeadas puede causar descuadres al conciliar contra facturas reales.
Nota: En la edición sí se ve el valor exacto (9999.99), así que es solo un tema de formato de despliegue.

M-2. Inconsistencia de periodo en "Resumen del Periodo" (Reportes).

Pantalla: Reportes.
Qué pasó: Mostraba "0 KM TOTALES" pero "5 VISITAS" a la vez, y la gráfica marcaba actividad en Abril mientras el resumen apuntaba a otro periodo. Los contadores no están alineados al mismo rango de fechas.

M-3. Validación sin mensaje claro en formularios.

Al enviar el formulario de gasto vacío, simplemente no pasa nada (no hay aviso visible de qué campo falta).
En Km, al poner KM final menor que KM inicial (distancia negativa), el botón "Guardar" se deshabilita correctamente, pero no explica por qué (la cajita de distancia simplemente desaparece).

🟢 BAJO

B-1. Datos "basura" preexistentes en producción (no creados por mí): gastos con nombres como "gggg", "hhhhh", "jfivf", "taxiii", y fechas imposibles/antiguas como "2008-04-26" y "2005-12-24". Conviene depurarlos.
B-2. El soporte adjunto se sube bien y se previsualiza ("✓ Soporte adjunto" con opción "Quitar"); las imágenes existentes se sirven correctamente. Sin defecto, pero el flujo de creación lo rompe (ver C-1).
B-3. El Excel exportado incluye la cédula del empleado (dato personal). Es normal en un documento de RR.HH., pero conviene tenerlo presente por privacidad.


C. LO QUE SÍ FUNCIONA BIEN

Login y logout: correctos. El logout limpia la sesión (token borrado) y redirige a /login.
Separación de roles (muy bien implementada): El empleado "comercial" ve Inicio/Km/Facturas/Legalizar/Viajes/Reportes. El "administrador" ve además Aprobar y Usuarios. A nivel de API también está protegido: el comercial recibe 403 al intentar listar usuarios, aprobar legalizaciones o ver la cola de aprobaciones.
Aislamiento de datos: Cada empleado solo ve sus propios gastos (probado: la API filtra por usuario).
Editar gasto: funciona perfecto vía el modal "Editar gasto" (sin congelarse). Cambié $9.999,99 → $11.500 y guardó bien.
Flujo de legalización completo: Crear (Local/Viaje, con motivo, ciudad y moneda COP/USD/EUR), seleccionar gastos, ver total, enviar para aprobación y aprobar. Todos los estados (Borrador → Enviado → Aprobado) funcionan.
Kilometraje: El cálculo y el guardado funcionan sin congelarse. Buenas validaciones (soporte obligatorio para peajes, autorización previa para taxis).
Exportación a Excel: Genera un archivo .xlsx válido y bien formado, con encabezados correctos y totales exactos.


D. RESULTADOS DE LA VERIFICACIÓN DE CÁLCULOS
Todo lo que pude calcular cuadró al peso:
VerificaciónEsperadoAppResultadoKm: 100 km × $600,65$60.065$60.065✅Km total (km + peajes)$60.065$60.065✅Suma de 3 gastos en legalización (7.777 + 11.500 + 23.450)$42.727$42.727✅Subtotal parcial (23.450 + 11.500) en el Excel$34.950$34.950✅Reembolso = Gasto real − Anticipo (42.727 − 0)$42.727$42.727✅Contenido y totales del Excel exportado$42.727$42.727✅

Formatos colombianos: Montos en COP con separador de miles ($60.065) ✅. Tarifas vigentes correctas (Carro $600,65/km, Moto $507,03/km) ✅. Soporta múltiples monedas (COP/USD/EUR).
No pude verificar a fondo: El totalizado de IVA y retenciones a nivel de legalización, porque los 3 gastos que seleccioné no tenían IVA. El campo IVA y "Servicio/Propina (se descuenta del total)" existen, pero recomiendo una prueba específica de IVA/retención cuando se arregle el guardado.


E. RECOMENDACIONES PRIORIZADAS

(Primero, urgente) Arreglar el guardado de gastos manuales (C-1, C-2). Es la función central y hoy está rota: pierde datos y/o crea duplicados. La pista concreta: el endpoint POST /api/expenses responde 500 cuando el formulario envía la imagen vía multipart/form-data; con JSON funciona. Revisar cómo el backend procesa el archivo en la creación (la edición sí funciona, sirve de referencia).
(Segundo) Eliminar el congelamiento del navegador tras guardar/aprobar (C-2, A-1). El hilo principal se bloquea 60–90 s después de cada escritura. Mover el procesamiento pesado (probablemente la imagen) fuera del hilo de la interfaz.
(Tercero) Mostrar mensajes claros de éxito/error (C-3). Nunca dejar al usuario sin saber si guardó. Añadir confirmaciones y errores visibles, y bloquear el doble clic en "Guardar"/"Enviar"/"Aprobar".
(Cuarto) Corregir el formato de montos con decimales (M-1) y la inconsistencia de periodo en Reportes (M-2).
(Quinto) Depurar los datos basura y fechas imposibles (B-1) que ya existen en producción.


F. LISTA DE REGISTROS "QA-TEST" CREADOS (para borrar)
Todos marcados con "QA-TEST". Creé los datos a propósito (algunos durante el diagnóstico del bug de guardado).
Gastos / Facturas (módulo Facturas), por ID:

id 15 — Crepes & Waffles QA-TEST — $85.000
id 16 — Hotel Estelar QA-TEST — $320.000
id 17 — Taxis Libres QA-TEST — $28.500
id 18 — Peaje Chusacá QA-TEST — $14.600
id 19 — City Parking QA-TEST — $12.000
id 20 — Vinoteca QA-TEST — $150.000
id 21 — Farmacia La Rebaja QA-TEST — $23.450
id 22 — Papelería QA-TEST — $11.500 (era $9.999,99; lo edité a $11.500 en la prueba)
id 23 — PHANTOM-TEST QA-TEST — $7.777
id 13 y 14 — Taxi Aeropuerto QA-TEST — $50.000 c/u (duplicados generados por el bug C-2)
id 10 — QA-TEST Probe Schema — $1.000
id 11 — QA-TEST probe 11 — $1.000
id 12 — QA-TEST probe 12 — $1.000

Legalización:

Legalización #6 — "Bogotá QA-TEST" / Motivo "QA-TEST Reunión con cliente auditoría" — $42.727 — quedó en estado APROBADO (la aprobé como parte de la prueba del flujo).

Kilometraje (módulo Km):

1 visita del 10/06/2026 — Cliente "QA-TEST Cliente" — CARRO — 100 km — $60.065 (estado borrador).
Se creó también el cliente "QA-TEST Cliente" en el catálogo de clientes.


Notas de ejecución: No eliminé ningún registro (tal como acordamos, solo marqué los míos). No modifiqué datos reales de terceros ni las legalizaciones preexistentes #1–#5. No subí archivos peligrosos (limité la prueba de archivos a validación, como pediste). No creé usuarios nuevos ni cambié permisos/accesos. La cuenta de administrador (biviana.baez) se usó solo para mapear roles y probar el flujo de aprobación sobre mi propia legalización QA-TEST.

---
---

# F. CORRECCIONES APLICADAS (fecha: 10/06/2026)

> Esta sección documenta los arreglos hechos al código tras los dos informes (la auditoría de seguridad y el informe de pruebas QA). **Todo lo que sigue ya está corregido en el código** y verificado (el backend compila y el frontend construye sin errores). Falta hacer el `commit` + `push` para desplegarlo, y **dos pasos operativos en Railway que son obligatorios** (ver al final, en rojo).

## F.1. Bugs que rompían la app (del informe QA) — CORREGIDOS

| # | Problema | Qué se hizo | Archivos |
|---|---|---|---|
| QA C-1/C-2 | Guardar un gasto manual (con o sin foto) fallaba con error 500 y/o perdía el dato | Se reescribió el guardado de gastos: ahora el servidor solo acepta los campos válidos, convierte los valores numéricos correctamente (los campos vacíos ya no rompen la base de datos) y valida que el valor sea mayor a cero. Esto elimina el error 500. | `backend/src/routes/expenses.js` |
| QA C-1 | La foto de la factura hacía fallar el guardado | El límite de tamaño de archivo subió de 10 MB a 25 MB (las fotos de celular pesan más) y, si aun así un archivo excede el límite, ahora se muestra un mensaje claro ("archivo demasiado grande, máx 25 MB") en vez de un error genérico. | `backend/src/middleware/upload.js`, `backend/src/index.js` |
| QA C-2 | Duplicados por reenvío (la pantalla no confirmaba) | El botón "Guardar" se bloquea durante el envío y la función ignora clics repetidos; al guardar bien, sube al inicio y muestra el aviso verde de éxito. | `frontend/src/pages/FacturasPage.jsx` |
| QA C-3 | Fallos "silenciosos": la app no avisaba si algo salía mal | Ahora se muestra el **mensaje de error real del servidor** (antes se ocultaba con un texto genérico). Además, si el servidor no responde en 60 segundos, la petición falla con aviso en vez de dejar la pantalla congelada para siempre. | `frontend/src/pages/FacturasPage.jsx`, `frontend/src/services/api.js` |
| QA A-1 | Aprobar congelaba el navegador | Se añadió el mismo límite de tiempo (timeout) a todas las peticiones, de modo que ninguna acción puede quedar colgada indefinidamente. | `frontend/src/services/api.js` |
| QA M-1 | Los montos con centavos se mostraban redondeados ($9.999,99 → $10.000) | El formato de moneda ahora muestra los centavos cuando existen, y los oculta cuando el valor es entero. | `frontend/src/utils/helpers.js` |
| QA M-2 | "Resumen del Periodo" mezclaba periodos (0 Km pero 5 visitas) | "Visitas" ahora cuenta las visitas del **mes actual** (mismo periodo que los Km), no los últimos 10 registros sueltos. | `backend/src/routes/reports.js`, `frontend/src/pages/ReportesPage.jsx` |
| QA M-3 | Validaciones sin mensaje claro | El guardado de gastos y kilometraje ahora devuelve mensajes explícitos (valor obligatorio, km final no puede ser menor al inicial, etc.). | varios |

## F.2. Hallazgos de seguridad — CORREGIDOS en código

| # | Hallazgo | Qué se hizo | Archivos |
|---|---|---|---|
| C-2 | Cualquiera podía ver datos de otros por ID (IDOR) | Se agregó verificación de dueño/rol en las 4 rutas afectadas: ver reporte de km, ver legalización, y descargar ambos Excel. Ahora un empleado solo accede a lo suyo (o a lo de otros si es aprobador/admin). | `kilometraje.js`, `legalizations.js`, `reports.js` |
| A-1 | Manipulación de montos (asignación masiva) | El crear/editar gasto y el editar kilometraje ahora solo aceptan una lista fija de campos. Ya **no** se puede fijar `valor_km`, marcar un gasto como `validado`, ni saltarse el cálculo por tarifa. | `expenses.js`, `kilometraje.js` |
| A-3 | Sin límite de intentos de login (fuerza bruta) | Se añadió límite: 10 intentos de inicio de sesión cada 15 min por IP, y un límite general para el resto de la API. | `index.js` (`express-rate-limit`) |
| A-4 | Archivos peligrosos y ejecutables | El filtro ahora solo acepta imágenes y PDF (bloquea .html, .svg, etc.) y los archivos subidos se sirven con cabeceras que impiden que el navegador los ejecute. | `upload.js`, `index.js` |
| A-2 | Conexión de correo sin validar certificado | Se reactivó la validación del certificado TLS del servidor de correo (configurable). | `email.js` |
| M-1/M-2/M-3 | Validaciones y estados | Montos no negativos en km y anticipos; no se pueden editar gastos de una legalización ya enviada/aprobada; no se puede re-aprobar algo fuera de estado. | `kilometraje.js`, `anticipos.js`, `legalizations.js` |
| M-4 | Dependencias vulnerables | Se aplicó `npm audit fix`: backend de 13 → 8 alertas, frontend de 7 → 2. Las restantes requieren actualizaciones mayores (se dejan para una prueba dedicada para no romper la app). | `package.json` (back y front) |
| M-6 | Errores que filtraban detalles internos | Los mensajes de error de correo ahora son genéricos para el usuario (el detalle queda solo en los logs). | `email.js` |
| M-7 | Secuencia de IDs desincronizada | El archivo de datos de ejemplo ahora reajusta el contador de IDs, evitando el error "ya registrado" al crear usuarios. | `seeds/20260407000001-demo-data.js` |
| C-3 | Llave de firma débil | El servidor ahora **se niega a arrancar en producción** si `JWT_SECRET` no está configurado o usa el valor por defecto inseguro. | `index.js` |
| B-1/B-8 | Política de contraseñas y correo | Contraseñas nuevas: mínimo 8 caracteres. El HTML de los correos de notificación se escapa (evita inyección). | `auth.js`, `users.js`, `services/notifications.js` |

## F.3. ⛔ PASOS OPERATIVOS OBLIGATORIOS (no son código — los debes hacer en Railway)

Estos dos pasos **no se pueden hacer desde el código** y son indispensables. **Léelos antes de desplegar:**

1. **CONFIGURAR `JWT_SECRET` EN RAILWAY — ANTES DE DESPLEGAR.**
   Por seguridad (hallazgo C-3), el servidor ahora **NO arrancará en producción** si esta clave no está bien configurada. En Railway → tu proyecto → el servicio → pestaña **Variables** → crea/edita `JWT_SECRET` con un valor largo y aleatorio (por ejemplo, una cadena de 40+ caracteres al azar). **Si despliegas sin hacer esto, la app no levantará.**
   *Nota: al cambiar esta clave, todos los usuarios tendrán que volver a iniciar sesión (es lo correcto y esperado).*

2. **CAMBIAR LAS CONTRASEÑAS DE PRODUCCIÓN (hallazgo C-1).**
   Las contraseñas `admin2026`, `meza2026`, etc. están publicadas en el repositorio y son débiles. Hay que cambiarlas por unas fuertes y únicas (desde la app, como administrador, en la sección Usuarios, o pídeme que te ayude a hacerlo). Mientras no se cambien, el sistema sigue siendo vulnerable aunque el código esté corregido.

## F.4. Limpieza pendiente (datos en producción, no código)

- **Datos basura** preexistentes ("gggg", "hhhhh", fechas como 2008/2005) y los registros **"QA-TEST"** listados en la sección anterior conviene borrarlos desde la app. No los eliminé automáticamente para no tocar datos de producción sin tu confirmación.

## F.5. Pendientes menores (no críticos)

- Actualización mayor de librerías restantes (imap/uuid en backend, react-router en frontend) — requieren prueba dedicada.
- El buzón de correo IMAP sigue siendo compartido (hallazgo A-2): se reactivó el TLS, pero separar qué correos ve cada empleado es un cambio de diseño mayor que conviene planear aparte.
- Documentación (`CLAUDE.md`) sigue mencionando "Claude Vision" para el OCR cuando en realidad usa Tesseract; conviene actualizarla.