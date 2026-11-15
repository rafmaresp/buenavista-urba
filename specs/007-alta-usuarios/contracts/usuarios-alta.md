# Contrato: secreto `USUARIOS_ALTA` y script `cargar-usuarios`

## Entrada

Secreto del entorno `infra`, texto plano, una línea por usuario:

```text
correo@ejemplo.com,directiva
otra.persona@ejemplo.com,comunero
```

Se recortan espacios; se ignoran líneas en blanco. Llega al script por la variable `USUARIOS_ALTA`.

## Ejecución

`node dist/scripts/cargar-usuarios.js` en `api/` con `USUARIOS_CONNECTION` (SAS `rad`) y `AUDITORIA_CONNECTION` (SAS `a`).

## Salida (stdout, también al resumen del job)

| Caso | Salida | Código |
|---|---|---|
| Sin secreto o vacío | `Sin USUARIOS_ALTA: no se da de alta a nadie.` | 0 |
| Correcto | `Lista: N usuarios. Ya existían: E. Altas: A.` | 0 |
| Línea inválida | `Línea L: <motivo>` por cada una (stderr) y `La carga ha fallado: …` | 1, sin escribir nada |
| Fallo de tabla o auditoría | `La carga ha fallado: <nombre> <código>` | 1 |

Nunca imprime correos ni cadenas de conexión. Solo si un alta queda sin auditar y no se puede deshacer, el error nombra su uid (aleatorio) para revisarla a mano.
