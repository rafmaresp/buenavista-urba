# CLAUDE.md · Buenavista I incidencias

Web para que los vecinos de la urbanización Buenavista I (Dos Hermanas, Sevilla) avisen de incidencias en el espacio público y la junta las gestione. Idioma de la UI, commits y PRs: español de España.

## Requisitos funcionales
- Tocar una farola en el mapa → incidencia "Farola fundida" con comentario opcional.
- Tocar una calle (tramo) → incidencia "Bache". Fuera de calle → "Otro". Tipos: `farola`, `bache`, `fuga`, `otro`.
- Los vecinos ven las incidencias abiertas (nuevo + en curso) para no duplicar.
  - Farola con incidencia abierta: no se crea otra, se ofrece "A mí también" (suma un apoyo).
  - Mismo tipo a menos de 20 m: se avisa y se ofrece apoyar en lugar de duplicar.
- Estados: `nuevo` → `encurso` → `completado`. Solo el rol `admin` los cambia.
- Panel de gestión (rol `admin`): todas las incidencias, filtros por estado, tipo y calle.
- Pendiente: aviso por correo a la junta al crear incidencia; fotos (Blob Storage); capa de redes (tuberías/cables) solo para la junta, cuando haya planos as-built.

## Privacidad (no negociable)
- Nunca pedir ni mostrar nombres de vecinos. No usar el plano de adjudicaciones (titulares) como capa.
- El contacto del reportante es opcional y **solo** lo devuelve `/api/gestion/*`. `/api/incidencias` nunca lo incluye.
- Datos mínimos (RGPD). No registrar IPs ni datos personales en logs.

## Estructura
- `web/` Angular (standalone, signals, zoneless) + Leaflet. Datos estáticos del mapa en `web/public/datos/buenavista.json` (69 farolas F01–F70 sin F62, 7 tramos).
- `api/` Azure Functions .NET 10 isolated (ASP.NET Core integration) + Azure Table Storage (`Azure.Data.Tables`).
- `web/public/staticwebapp.config.json` rutas y roles de SWA. `/api/gestion/*` exige rol `admin`.
- `data/` KML/CSV originales de farolas. `prototipo/` prototipo HTML de referencia (no se despliega).
- Precisión de farolas: verificadas ±2–3 m, estimadas ±5–8 m.

## API
| Método | Ruta | Rol |
|---|---|---|
| GET | `/api/incidencias` | anónimo (sin `contacto`) |
| POST | `/api/incidencias` | anónimo |
| POST | `/api/incidencias/{id}/apoyos` | anónimo |
| GET | `/api/gestion/incidencias` | admin |
| PATCH | `/api/gestion/incidencias/{id}` | admin |

Nota: en Azure Functions el prefijo de ruta `admin` está reservado; por eso es `gestion`.

## Desarrollo local
- Azurite para Table Storage (`UseDevelopmentStorage=true`), `func start` en `api/`, `npm start` en `web/`, o todo junto con `swa start` (SWA CLI emula `/.auth` y roles).
- Copia `api/local.settings.sample.json` a `api/local.settings.json`.

## Convenciones para agentes
- Una tarea = una rama `claude/<tema>` = un PR pequeño. Nada directo a `main`.
- Antes de push: `npm run build` en `web/` y `dotnet build` en `api/` (si el entorno no tiene npm/.NET, lo valida el workflow `ci.yml`).
- No añadir dependencias ni servicios de pago sin decirlo en el PR con su coste.
- Secretos solo en GitHub Secrets / app settings de Azure. Nunca en el repo.
