# Propuesta RGPD/LOPDGDD para la v1 de Buenavista I · Incidencias

Autor: Rai. Fecha: 2026-11-12. Propuesta para decisión de Rafa. No soy abogado: lo marcado (VALIDAR) lo debe revisar un profesional (abogado de protección de datos o administrador de fincas con asesoría jurídica).

**Veredicto: 🟡.** Plan viable (datos mínimos, sin analítica, rol en servidor). Cuatro condiciones antes del cambio 4 `login-roles`: seudonimización (sec. 2), lista cerrada (3), visibilidad del comentario (4), cláusula y registro de actividades (5). Sería 🔴 si se guardaran emails o texto libre en una auditoría append-only sin vía de supresión.

## 1. Responsable, encargados y bases jurídicas

- **Responsable (art. 4.7)**: la Comunidad de Propietarios Buenavista I, representada por su presidente/directiva. Decide fines y medios.
- **Rafa y los devs: encargados (art. 28)** con encargo escrito de una página firmado por el presidente (objeto, datos, medidas, subencargados, devolución/borrado, confidencialidad), aunque Rafa trabaje gratis. Si hay administrador de fincas, preguntar si Rafa sería su subencargado (VALIDAR).

| Tratamiento | Base | Notas |
|---|---|---|
| Acceso y lista de autorizados (email, sub, rol) | 6.1.f interés legítimo (gestión y seguridad de servicios comunes) | No consentimiento: no sería libre y es revocable. Guardar ponderación de 1 párrafo |
| Incidencias y votos | 6.1.f (mantenimiento de elementos comunes, LPH arts. 10 y 14) | El voto liga al uid solo para garantizar un voto por persona |
| Avisos por correo | 6.1.f, parte del servicio | Solo cambios de estado y avisos a la directiva; nada de novedades |
| Auditoría | 6.1.f y art. 32 (seguridad, integridad) | Debe ser necesaria: minimizada (sec. 2) |
| Lista cerrada | 6.1.f | Sec. 3 |

Sin categorías especiales (art. 9) ni decisiones automatizadas (art. 22).

## 2. Auditoría

**Recomendación: la auditoría guarda un `uid` interno aleatorio (UUID v4), no email ni `sub`.** Mejor que el HMAC del sub: sin clave que custodiar o rotar, y al borrar el mapeo no se puede recalcular.

1. Tabla `Usuarios` (PK `uid`): `email` normalizado, `sub` (nulo hasta el primer login), `rol` (comunero/directiva), `estado` (activo/baja/suprimido), `alta`, `baja`. Única correspondencia uid-persona y a la vez la lista cerrada (0 € extra).
2. El uid se crea al cargar la lista. El primer login busca por email (`email_verified=true`) y fija el sub; después se identifica por sub.
3. Auditoría, `actor`: uid, `sistema:*` o `dev:<alias>`. Los cambios de lista/rol se auditan con el uid del afectado.
4. **Prohibido en antes/despues**: email, sub, nombre y texto del comentario (se audita `{presente, longitud}`). Test automático en el cambio 2.
5. La app solo inserta en `Auditoria`. `PartitionKey = AAAA-MM` para purgar por meses.
6. Logs de Functions sin email, tokens ni cuerpos; retención ≤30 días.

**Supresión (art. 17), a cargo de los devs en ≤1 mes tras verificar identidad**: vaciar email y sub, estado `suprimido`; `autor = null` en incidencias y votos anónimos (se conserva el recuento); borrar el comentario si lo pide; entrada de auditoría "usuario suprimido" (uid, `dev:<alias>`) sin datos personales. Los uids de la auditoría quedan sin vínculo posible. Riesgo residual: reidentificación por contexto, por eso el comentario no se copia a la auditoría (VALIDAR que sea anonimización suficiente; art. 17.3.e ampara conservar lo necesario para reclamaciones).

**Plazos propuestos (VALIDAR)**

| Dato | Plazo | Al vencer |
|---|---|---|
| Usuario activo | Mientras sea comunero | Pasa a `baja`, acceso cortado de inmediato |
| Usuario de baja | Email y sub se borran a los **30 días** | Queda uid, estado y fechas |
| Revisión de la lista | Anual (tras la junta ordinaria) y al cambiar la directiva | Altas/bajas por los devs, auditadas |
| Incidencia completada | Autor y comentario **12 meses** desde completarla | autor = null, comentario borrado; se conserva la incidencia sin datos personales |
| Votos | Hasta **12 meses** tras completar | Se borra el uid, queda el recuento |
| Auditoría | **3 años** (compromiso entre prescripción de 1 año del art. 1968 CC y 5 años del art. 1964 CC, y minimización) | Purga por partición, anotada en un registro de purgas |
| Correos | Sin copia en la app; en el proveedor, lo mínimo (≤30 días) | — |
| Copias de seguridad | Si se crean, ≤30 días | — |

## 3. Lista cerrada de correos

Recomendada (responde a la pendiente 5). Mínimos:
- **Origen**: libro de propietarios de la comunidad o su administrador, o mejor un formulario voluntario donde el vecino da el correo con el que entrará. Nunca copiar de grupos de WhatsApp. Debe constar quién entrega la lista y con qué autoridad (VALIDAR si el administrador puede cederla).
- **Minimización**: solo email y rol; sin nombre, vivienda ni teléfono.
- **Información (arts. 13/14)**: aviso a todos antes de la primera carga con la sec. 5 y enlace a la política (art. 14: máximo un mes si el correo no lo dio el vecino).
- Decidir si entran inquilinos o familiares; cuentas personales, no un correo compartido por vivienda.
- Solo los devs ven la lista; el rol directiva solo lo cambian los devs a petición documentada del presidente, auditado.
- **Baja**: estado comprobado en cada petición; borrado de email a los 30 días.
- **No autorizados**: 403 genérico y no guardar su email, ni en logs.
- Riesgos residuales: cuenta de Google comprometida (exigir `email_verified`), correo reasignado (revisión anual).

## 4. Comentarios libres

- Aviso junto al campo: "Describe solo el problema de la farola. No escribas nombres, matrículas, teléfonos ni datos de salud de nadie."
- Máximo 280 caracteres, texto plano, solo al crear.
- **Recomiendo que el comentario lo vea solo la directiva y el autor** (hoy no está definido en `project.md`).
- La directiva puede ocultar/borrar el texto (acción auditada sin copiar el texto). Un tercero afectado lo pide a la comunidad.
- El comentario no va a la auditoría ni a los correos (solo enlace).
- La cláusula informa de qué ve la directiva del autor.

## 5. Mínimos obligatorios para la v1

1. **Cláusula en dos capas.** Capa 1 en el login, antes del botón de Google (texto propuesto, VALIDAR):
   > Responsable: Comunidad de Propietarios Buenavista I. Finalidad: gestionar los avisos de farolas y otras incidencias y avisarte por correo de los cambios en las tuyas. Datos: tu correo, tu identificador de Google, tus incidencias, comentarios y votos, y un registro de las acciones realizadas. Base: interés legítimo de la comunidad en el mantenimiento de las zonas comunes y la seguridad del servicio. La directiva ve quién crea cada incidencia; los demás vecinos no. Conservación: mientras seas comunero; después, hasta 12 meses las incidencias y hasta 3 años el registro de acciones, sin identificarte tras tu baja. Destinatarios: Microsoft Azure (UE), Google (inicio de sesión) y [proveedor de correo]. Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad en [correo de la comunidad]; reclamación ante la AEPD. [Política completa]

   Capa 2: página `/privacidad` con bases, plazos, encargados, transferencias, derechos y contacto.
2. **Registro de actividades (art. 30)**: ficha de 1-2 páginas con los cinco tratamientos, versionada en el repositorio. La excepción de <250 empleados no vale para tratamientos no ocasionales.
3. **EIPD: no obligatoria.** Pocos interesados, sin categorías especiales a gran escala, sin perfilado ni seguimiento sistemático, y no está en la lista de la AEPD. Dejar nota de umbral de 1 página; reevaluar si se añaden fotos (v2) o geolocalización de personas. Sin DPD obligatorio (VALIDAR).
4. **Encargados y transferencias**:
   - Azure (SWA, Functions, Storage): DPA en las Condiciones de Servicios en línea; todos los recursos en región UE; comprobar que la Function no se despliega fuera. Acceso desde EE. UU. cubierto por DPF y cláusulas tipo (VALIDAR vigencia).
   - Google GIS: recibe IP y metadatos al cargar el script; cargarlo solo en la pantalla de login e informarlo.
   - Correo: encargado con DPA, mejor UE. Opciones: ACS (mismo DPA que Azure, de pago, consultar) o Brevo (UE). Resend (EE. UU.) exige DPF/cláusulas. **Descarto Gmail personal** (sin DPA, cuenta privada, frágil).
   - Mapa: PNOA (IGN) y OSM reciben la IP del vecino; mencionarlo en la política y autohospedar fuentes y librerías.
5. **Seguridad (art. 32)**: HTTPS, acceso público al Storage desactivado, secretos fuera del repositorio, TLS ≥1.2, ID token validado en cada Function y no almacenado, logs sin PII.
6. **Procedimientos**: canal de derechos con respuesta en un mes; protocolo de brecha (AEPD en 72 h si hay riesgo); script de supresión.
7. Sin cookies de rastreo ni analítica; si Google pone cookies en el login, informar (VALIDAR LSSI 22.2).

## 6. Impacto en la hoja de ruta

| # | Cambio | Requisito que añadiría |
|---|---|---|
| 1 | `scaffold-plataforma` | Recursos Azure en región UE; sin Application Insights ni telemetría con PII; logs sin tokens ni emails; sin recursos de CDN de terceros. |
| 2 | `catalogo-farolas` | Storage sin acceso público, TLS ≥1.2, región UE. Contrato de `auditar()`: actor = uid opaco o `sistema:*`/`dev:*`; `PartitionKey = AAAA-MM`; prohibidos email, sub, nombre y texto libre en antes/despues, con test. La app solo inserta en `Auditoria`. |
| 3 | `mapa-farolas` | Política menciona que PNOA y OSM reciben la IP; decisión sobre mapa público. |
| 4 | `login-roles` | Bloqueo hasta cerrar: tabla `Usuarios` con uid aleatorio como única correspondencia; lista cerrada (403 genérico sin guardar email); `email_verified`; estado comprobado en cada petición; actor = uid; cláusula capa 1 y `/privacidad`; GIS solo en el login; script de baja y supresión auditado; registro de actividades y nota de umbral de EIPD; encargo firmado por la comunidad. |
| 5 | `reportar-incidencia-farola` | Comentario ≤280 con aviso; visible solo a directiva y autor; la API no devuelve el autor a comuneros; auditoría con `{presente, longitud}`; autor como uid. |
| 6 | `votos-incidencia` | Voto = (incidencia, uid); la API devuelve recuento y "has votado", nunca votantes. |
| 7 | `gestion-estados` | Acción "ocultar comentario" auditada sin texto; la directiva ve del autor solo lo necesario, consta en la cláusula. |
| 8 | `reubicar-farola` | Sin datos personales; actor = uid; antes/despues solo coordenadas y precisión. |
| 9 | `avisos-correo` | Proveedor con DPA (UE o DPF); correo minimizado (farola, estado, enlace; sin comentario); email leído de `Usuarios` al enviar, no copiado a cola, incidencia ni auditoría; reintentos con uid; no enviar a usuarios en baja; logs sin cuerpo; enlace a la política. |
| 10 | `baches-flag` | Mismos requisitos que el 5; si hay fotos en v2, reevaluar EIPD y aviso de no fotografiar personas ni matrículas. |
| Nuevo | `retencion-y-derechos` (S, antes del primer año en producción) | Script/Function manual de los devs: purga de comentarios y desvinculación de autores y votos a 12 meses, borrado de bajas a 30 días, purga de auditoría >3 años, supresión a petición; cada ejecución se registra. |

## Qué debe validar un profesional
Base 6.1.f y ponderación; papel de encargado de Rafa y encargo; cesión de correos por el administrador e inclusión de inquilinos; suficiencia de la anonimización; plazos y cláusula; vigencia de DPF/cláusulas de Microsoft y Google; cookies de Google (LSSI 22.2).

## Preguntas para Rafa
1. ¿Quién firma como responsable (presidente) y se informa a la junta?
2. ¿De dónde sale la lista, quién la mantiene, entran inquilinos?
3. ¿El comentario lo ve toda la comunidad o solo la directiva (recomendado)?
4. ¿Qué ve la directiva del autor?
5. ¿Correo: ACS (consultar coste) o Brevo?
6. ¿Plazos 30 días / 12 meses / 3 años?
7. ¿Qué correo de la comunidad recibe las peticiones de derechos?
