# Contrato consumido: `GET /api/farolas`

Definido en [`specs/003-catalogo-farolas/contracts/get-farolas.md`](../../003-catalogo-farolas/contracts/get-farolas.md); este cambio no lo modifica.

Uso desde la web:

- Petición `GET /api/farolas` (misma origen, sin credenciales ni cabeceras extra).
- `200` con `{ farolas: FarolaPublica[] }` válido → se pintan todas.
- `200` con `{ farolas: [] }` → mapa sin marcas, sin error.
- Cualquier otro estado, error de red o cuerpo con forma inesperada → estado `error` con "Reintentar".
