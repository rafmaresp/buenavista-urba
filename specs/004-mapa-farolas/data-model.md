# Data Model: Mapa de farolas en solo lectura

No se crean ni modifican tablas. La web consume la entidad pública del catálogo.

## FarolaPublica (lectura)

| Campo | Tipo | Regla en el cliente |
|---|---|---|
| `id` | string | `^F\d{2}$` |
| `calle` | string | no vacía |
| `lat` | number | finito |
| `lon` | number | finito |

- Una respuesta sin `farolas` como array, o con un elemento que no cumpla las reglas, se trata como error de carga (FR-006). No se filtran elementos sueltos: un catálogo malformado es un fallo, no un mapa parcial silencioso.
- Nunca incluye `precision`.

## Estado de la carga (solo en el componente)

`cargando` → `ok` | `error`; desde `error`, "Reintentar" vuelve a `cargando`.
