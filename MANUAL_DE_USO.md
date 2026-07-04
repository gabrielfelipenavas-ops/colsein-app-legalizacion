# 📱 Manual de Uso — App de Legalizaciones COLSEIN

**COLSEIN S.A.S. — Sistema de Gestión de Gastos, Kilometraje y Legalizaciones**

Este manual explica cómo instalar la aplicación en tu celular (para que quede
como una app normal, con su ícono en la pantalla de inicio) y cómo usar cada
una de sus funciones según tu rol.

> 💡 La app funciona en el navegador, pero **se instala como una app nativa**
> (sin pasar por App Store ni Google Play) gracias a la tecnología PWA.
> Una vez instalada, se abre a pantalla completa con el ícono azul de
> **LEGALIZACIONES COLSEIN**.

---

## 1. Instalar la app en tu celular

Necesitas el **enlace de la aplicación** (te lo entrega el administrador;
es una dirección tipo `https://app.colsein.co` o `https://…up.railway.app`).

### 📱 En iPhone / iPad (iOS)

> ⚠️ En iOS la instalación **solo funciona desde Safari** (el navegador de
> la brújula azul). No uses Chrome para este paso.

1. Abre **Safari** y entra al enlace de la aplicación.
2. Toca el botón **Compartir** (el cuadrito con la flecha hacia arriba ⬆️,
   en la barra inferior).
3. Desliza hacia abajo en el menú y toca **"Añadir a pantalla de inicio"**
   (*Add to Home Screen*).
4. Verás el ícono azul y el nombre **COLSEIN**. Toca **"Añadir"** (arriba a
   la derecha).
5. ¡Listo! El ícono queda en tu pantalla de inicio, como cualquier otra app.
   Ábrela siempre desde ese ícono.

### 🤖 En Android

1. Abre **Chrome** y entra al enlace de la aplicación.
2. Normalmente Chrome muestra solo un aviso **"Instalar aplicación"** o
   **"Añadir COLSEIN a la pantalla principal"** — tócalo y confirma.
3. Si no aparece el aviso: toca el menú de los **tres puntos ⋮** (arriba a la
   derecha) → **"Instalar aplicación"** (o **"Añadir a pantalla de inicio"**)
   → **Instalar**.
4. El ícono de **COLSEIN** queda en tu pantalla de inicio y en el cajón de
   aplicaciones.

### ✅ Cómo saber que quedó bien instalada

- El ícono azul de **LEGALIZACIONES** aparece en tu pantalla de inicio con el
  nombre **COLSEIN**.
- Al abrirla desde el ícono, se ve a pantalla completa (sin la barra de
  direcciones del navegador).

> 🔒 **Requisito:** el enlace debe abrir con candado de seguridad (HTTPS).
> Si el navegador muestra advertencias de seguridad, avisa al administrador.

---

## 2. Ingresar por primera vez

1. Cuando el administrador crea tu cuenta, **te llega un correo** con tu
   **usuario (email)** y tu **contraseña**.
2. Abre la app, escribe tu email y contraseña, y toca **Ingresar**.
3. **Cambia tu contraseña** apenas entres (recomendado):
   - Toca el ícono de la **llave 🔑** en la barra superior (junto a la campana
     de notificaciones).
   - Escribe tu contraseña actual, la nueva (mínimo 8 caracteres) y su
     confirmación → **Cambiar contraseña**.

> ¿Olvidaste tu contraseña? Pídele al administrador que te la restablezca:
> te llegará un correo con la nueva.

---

## 3. Conoce la pantalla

**Barra superior:** tu nombre y rol · campana de **notificaciones** 🔔 ·
**llave** 🔑 (cambiar contraseña) · **salir** de la sesión.

**Menú inferior** (las pestañas visibles dependen de tu rol):

| Pestaña | Para qué sirve |
|---|---|
| 🏠 **Inicio** | Resumen del mes: km, visitas, valor a pagar, accesos rápidos y últimas visitas |
| 🛣️ **Km** | Registrar visitas y kilometraje del mes, y enviar el reporte mensual |
| 📷 **Facturas** | Escanear/registrar facturas de gastos (con lectura automática OCR) |
| 📄 **Legalizar** | Agrupar facturas en una legalización y enviarla a aprobación |
| 🧳 **Viajes** | Solicitar anticipos de viaje |
| 📊 **Reportes** | Estadísticas del mes y descarga de documentos Excel oficiales |
| ✅ **Aprobar** | (Solo aprobadores) Revisar y aprobar solicitudes del equipo |
| 🧮 **Contab.** | (Solo contabilidad/dirección) Auditoría contable y archivo plano |
| 👥 **Usuarios** | (Solo administración/dirección) Crear y gestionar usuarios |

---

## 4. Kilometraje (pestaña **Km**)

### Registrar una visita

1. Toca **"Registrar Visita"**.
2. Completa: **fecha**, **cliente** (escribe 2+ letras y selecciónalo del
   catálogo; si no existe puedes crearlo ahí mismo), **medio** (CARRO o MOTO)
   y **km inicial / km final** del odómetro.
   - ¿No tienes odómetro? Usa **"Estimar km en el mapa"** para calcular la
     distancia del recorrido.
   - También puedes usar **"Iniciar recorrido con GPS"** para que la app
     estime los km mientras te desplazas.
3. Si tuviste gastos de apoyo ese día, regístralos en la misma visita:
   - **Peajes** → foto del tiquete **obligatoria**.
   - **Parqueaderos** → foto del recibo **obligatoria** (el recibo debe tener
     fecha, nombre, NIT, régimen, dirección, resolución de facturación y valor).
   - **Taxis / apps de transporte** → requieren **autorización previa**
     (botón "Solicitar autorización" en el formulario), tipo de servicio,
     origen y destino. Las apps (Uber, InDriver, DiDi…) exigen factura/captura.
4. Toca **Guardar Registro**.

> ⚠️ El **km final no puede ser menor que el km inicial** — la app te avisa.
> Sin foto de soporte no se reconoce el valor del gasto de apoyo.
> No se reconoce kilometraje por desplazamientos a oficinas de Colsein.

### Enviar el reporte del mes

- La tabla **Detalle** muestra cada visita con su **Valor Km** (km × tarifa) y
  sus **Apoyos** (peajes, parqueaderos, taxis, otros) por separado, y al final
  el **TOTAL A PAGAR** (km + apoyos).
- Tarifas vigentes: **CARRO $600,65/km · MOTO $507,03/km**.
- Cuando termines el mes, toca el botón de **enviar** ✈️ (junto a "Registrar
  Visita"). El reporte pasa a revisión de tu líder/gerencia.
- 📅 **Plazo:** el reporte se entrega dentro de los **primeros 5 días
  calendario del mes siguiente**. No es acumulable.
- Puedes descargar el **Excel en formato oficial** con un toque.

---

## 5. Facturas (pestaña **Facturas**)

1. Toca **escanear/subir factura** y toma la foto (o elige un PDF).
2. La app lee automáticamente los datos con **OCR**: establecimiento, NIT,
   fecha, valor, IVA… **Revisa siempre los campos** y corrige lo necesario.
3. Selecciona la **categoría** (alimentación, alojamiento, transportes, etc.)
   y el **medio de pago**, y toca **Guardar**.

> ⚠️ **Fechas:** la app rechaza fechas imposibles (futuras o de más de 2 años).
> Si el OCR lee mal la fecha del recibo, el campo queda en rojo con una
> advertencia — corrígela antes de guardar. Los gastos con fecha dudosa se
> marcan con la etiqueta **"⚠ Fecha sospechosa"**.
>
> 💡 La **propina** y el excedente de **servicio** sobre el 10% **no** se
> reconocen en la legalización; la app calcula automáticamente el valor
> legalizable.
>
> ¿No tienes el soporte físico? Marca **"Sin soporte"** y escribe la
> justificación (queda registrada para el aprobador).

---

## 6. Legalizar gastos (pestaña **Legalizar**)

### Crear y enviar una legalización

1. Toca **"Nueva Legalización"**.
2. Elige el tipo: **Gasto Local** (gastos en tu ciudad) o **Viaje** (puedes
   vincularla a un anticipo aprobado).
3. Completa **motivo** (para gastos locales) y **ciudad(es)** — la app no te
   deja avanzar si faltan.
4. **Selecciona las facturas** a incluir. Solo aparecen los gastos **sin
   legalizar** (una factura ya incluida en otra legalización no se puede
   repetir).
5. Toca **"Crear Legalización"**. Queda en **borrador**: puedes seguir
   **agregando o quitando facturas** con el botón **Editar** todas las veces
   que necesites.
6. Cuando esté completa, toca **Enviar** (en la tarjeta de la legalización o
   en el resumen). ⚠️ **Después de enviarla ya no se puede modificar.**

### ¿Necesitas corregir una legalización ya enviada?

1. En la tarjeta de la legalización toca **"Solicitar modificación"** 🔓 y
   escribe el motivo.
2. La solicitud le llega a **gerencia/presidencia**, que la autoriza o
   rechaza desde la app.
3. Si la autorizan, la legalización **vuelve a borrador**: podrás editarla y
   **enviarla de nuevo**.

> 📅 **Plazo:** los anticipos se legalizan máximo **3 días** después del
> regreso del viaje.

---

## 7. Anticipos de viaje (pestaña **Viajes**)

1. Toca **solicitar anticipo** y completa: motivo, proceso, ciudad destino y
   **fechas de ida y regreso**.
2. Escribe el **presupuesto por día** (alojamiento, alimentación, transportes,
   imprevistos, representación). La app calcula **en vivo** la duración, el
   **presupuesto total** y el **anticipo solicitado** (alimentación +
   transportes × días).
3. Acepta el compromiso de legalización y **envía**.
4. Te llegará una notificación (y correo) cuando lo aprueben o rechacen.

---

## 8. Reportes (pestaña **Reportes**)

- Resumen del mes: **km totales** y **visitas del mes** (las mismas cifras
  que ves en Inicio), gráfico del año y **desglose de costos** (kilometraje,
  peajes, parqueaderos, taxis, otros).
- Descarga de documentos oficiales en Excel:
  - **Registro de Medios de Transporte** (formato oficial V.08).
  - **Legalización de Gastos** (desglose por día y categoría).

---

## 9. Aprobaciones (pestaña **Aprobar** — solo aprobadores)

Ahí llegan las **legalizaciones, reportes de kilometraje, anticipos y
solicitudes de autorización** (taxis, gastos especiales y modificaciones)
pendientes por decidir. Cada elemento se puede **aprobar** o **rechazar**
(el rechazo siempre exige un comentario con el motivo, que le llega al
solicitante por notificación y correo).

**Jerarquía de aprobación:**

| Quién envía | Quién aprueba |
|---|---|
| Comercial | Líder Regional (revisa) → Gerente de Ventas (aprueba) |
| Desarrollador de Negocios AVEVA | Gerente AVEVA |
| Administrador | Gerente General o Presidente |
| Gerente (Ventas, General o AVEVA) | **Solo el Presidente** |
| Presidente | Nadie — sus envíos quedan **aprobados automáticamente** |

Reglas fijas: **nadie aprueba sus propias solicitudes**, el Gerente AVEVA
solo aprueba a su línea, y Control Interno / Contabilidad / Administrador
ven todo para auditoría pero **no aprueban**.

---

## 10. Usuarios (pestaña **Usuarios** — solo administración/dirección)

1. Toca **"Nuevo"** y completa nombre, cédula, email, contraseña (mínimo 8
   caracteres), rol, zona y vehículo.
2. Al guardar, **el sistema le envía automáticamente un correo al usuario**
   con su email, su contraseña y el enlace de la app.
3. Si restableces la contraseña de alguien (editar usuario → nueva
   contraseña), también le llega el correo con los nuevos datos.
4. Desde la misma pantalla puedes **desactivar** usuarios que ya no deben
   ingresar.

> Si la app avisa que "no se pudo enviar el correo", el servidor no tiene
> configurado el envío de correos (SMTP) — entrega las credenciales
> manualmente y avisa al responsable técnico.

---

## 11. Notificaciones 🔔

La campana de la barra superior muestra todo lo que te concierne: solicitudes
pendientes por aprobar, aprobaciones, rechazos (con el comentario del
aprobador) y autorizaciones. Los mismos avisos llegan **por correo
electrónico**. Toca una notificación para ir directo a la sección
correspondiente.

---

## 12. Problemas frecuentes

| Problema | Solución |
|---|---|
| "Credenciales incorrectas" al ingresar | Verifica el email y la contraseña del correo de bienvenida. Si no funciona, pide al administrador restablecer tu contraseña. |
| No me aparece "Añadir a pantalla de inicio" en iPhone | Debes usar **Safari** (no Chrome) y abrir el enlace directo de la app. |
| No me llega el correo de credenciales | Revisa **spam/correo no deseado**; si no está, pide al administrador reenviar (restableciendo la contraseña). |
| La app no me deja guardar un gasto | Revisa la **fecha** (no puede ser futura ni de más de 2 años) y que tenga **valor** y **soporte** (foto/PDF) o la justificación de "Sin soporte". |
| No puedo editar mi legalización | Ya fue enviada: usa **"Solicitar modificación"** y espera la autorización de gerencia/presidencia. |
| No veo la pestaña Aprobar / Usuarios | Esas pestañas solo aparecen para los roles autorizados. |
| La app se ve "vieja" o con errores tras una actualización | Ciérrala por completo y vuelve a abrirla (desliza para cerrarla en el selector de apps). |

---

*COLSEIN S.A.S. (NIT 800002030) — Sistema de Legalizaciones. Manual de uso v1.0.*
