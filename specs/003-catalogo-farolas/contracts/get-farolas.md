# Contrato: `GET /api/farolas`

Anónimo. Sin parámetros.

## 200 OK

Cabeceras: `Content-Type: application/json`, `Cache-Control: public, max-age=300`.

```json
{
  "farolas": [
    { "id": "F01", "calle": "C. M (paralela A-8032)", "lat": 37.3186864, "lon": -5.961454 }
  ]
}
```

- Ordenadas por `id`.
- Solo `id`, `calle`, `lat`, `lon`. Nunca `precision`, `PartitionKey`, `RowKey`, `timestamp` ni `etag`.
- Catálogo sin sembrar: `{ "farolas": [] }`.

## 500

Cabeceras: `Cache-Control: no-store`. Cuerpo: `{ "error": "No se pudo cargar el catálogo de farolas" }`. Sin detalles internos; el error se registra sin la cadena de conexión.

## Fuera de este contrato

`PUT /api/farolas/{id}` (reubicar) y `POST /api/farolas` (crear), solo directiva, en el cambio 8.
