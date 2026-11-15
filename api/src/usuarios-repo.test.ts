import { describe, expect, it } from 'vitest';
import { UID_ANA, auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { AltaUsuarioSinAuditar, RepositorioUsuarios, VinculacionSinAuditar } from './usuarios-repo';

function preparar(opciones: { auditoriaFalla?: boolean; deshacerFalla?: boolean } = {}) {
  const filas = [filaAna()];
  const { cliente, orden } = tablaUsuarios(filas, opciones);
  const auditoria = auditoriaDoble(orden, opciones.auditoriaFalla);
  return { filas, orden, cliente, auditoria, repo: new RepositorioUsuarios(cliente, auditoria) };
}

describe('RepositorioUsuarios', () => {
  it('busca por email y por sub dentro de la partición, con filtros escapados', async () => {
    const { repo, cliente } = preparar();
    const [ana] = await repo.buscarPorEmail('ana@example.com');
    expect(ana).toMatchObject({ uid: UID_ANA, rol: 'comunero', estado: 'activo', sub: '', etag: 'W/"1"' });
    expect(await repo.buscarPorSub("x' or true")).toEqual([]);
    const filtro = cliente.listEntities.mock.calls[1]![0]!.queryOptions!.filter!;
    expect(filtro).toBe("PartitionKey eq 'usuario' and sub eq 'x'' or true'");
  });

  it('vincularSub guarda el sub con el ETag leído y lo audita sin email ni sub', async () => {
    const { repo, filas, orden, cliente, auditoria } = preparar();
    const [ana] = await repo.buscarPorEmail('ana@example.com');
    await repo.vincularSub(ana!, 'google-123');

    expect(orden).toEqual([`vincular ${UID_ANA}`, `auditoria ${UID_ANA}`]);
    expect(filas[0]!.sub).toBe('google-123');
    expect(cliente.updateEntity.mock.calls[0]![2]).toEqual({ etag: 'W/"1"' });
    const entrada = auditoria.createEntity.mock.calls[0]![0];
    expect(entrada).toMatchObject({ actor: UID_ANA, accion: 'usuario.vincular', entidad: 'Usuarios', clave: UID_ANA });
    expect(JSON.parse(entrada.antes)).toEqual({ vinculado: false });
    expect(JSON.parse(entrada.despues)).toEqual({ vinculado: true });
    expect(JSON.stringify(entrada)).not.toMatch(/example\.com|google-123/);
  });

  it('si la auditoría falla, deshace la vinculación y propaga el error', async () => {
    const { repo, filas, orden } = preparar({ auditoriaFalla: true });
    const [ana] = await repo.buscarPorEmail('ana@example.com');
    await expect(repo.vincularSub(ana!, 'google-123')).rejects.toThrow('Auditoria no disponible');
    expect(orden).toEqual([`vincular ${UID_ANA}`, `auditoria ${UID_ANA}`, `deshacer ${UID_ANA}`]);
    expect(filas[0]!.sub).toBe('');
  });

  it('si tampoco se puede deshacer, lanza VinculacionSinAuditar', async () => {
    const { repo } = preparar({ auditoriaFalla: true, deshacerFalla: true });
    const [ana] = await repo.buscarPorEmail('ana@example.com');
    await expect(repo.vincularSub(ana!, 'google-123')).rejects.toBeInstanceOf(VinculacionSinAuditar);
  });

  it('con un ETag viejo no vincula ni audita', async () => {
    const { repo, orden } = preparar();
    const [ana] = await repo.buscarPorEmail('ana@example.com');
    await expect(repo.vincularSub({ ...ana!, etag: 'W/"0"' }, 'google-123')).rejects.toMatchObject({ statusCode: 412 });
    expect(orden).toEqual([`vincular ${UID_ANA}`]);
  });
});

describe('RepositorioUsuarios: altas (007-alta-usuarios)', () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function prepararAlta(opciones: { auditoriaFalla?: boolean; borrarFalla?: boolean } = {}) {
    const filas = [filaAna({ estado: 'baja' })];
    const { cliente, orden, creadas } = tablaUsuarios(filas, opciones);
    const auditoria = auditoriaDoble(orden, opciones.auditoriaFalla);
    return { filas, orden, creadas, auditoria, repo: new RepositorioUsuarios(cliente, auditoria) };
  }

  it('emails devuelve los correos de toda la partición, en cualquier estado', async () => {
    const { repo } = prepararAlta();
    expect(await repo.emails()).toEqual(new Set(['ana@example.com']));
  });

  it('crear guarda un usuario activo sin sub con uid aleatorio y audita usuario.alta sin el correo', async () => {
    const { repo, orden, creadas, auditoria } = prepararAlta();
    const uid = await repo.crear({ email: 'bea@example.com', rol: 'directiva' }, 'sistema:carga');

    expect(uid).toMatch(UUID_V4);
    expect(orden).toEqual([`alta ${uid}`, `auditoria ${uid}`]);
    expect(creadas[0]).toMatchObject({
      partitionKey: 'usuario',
      rowKey: uid,
      email: 'bea@example.com',
      sub: '',
      rol: 'directiva',
      estado: 'activo',
      baja: '',
    });
    expect(Number.isNaN(Date.parse(creadas[0]!.alta))).toBe(false);
    const entrada = auditoria.createEntity.mock.calls[0]![0];
    expect(entrada).toMatchObject({ actor: 'sistema:carga', accion: 'usuario.alta', entidad: 'Usuarios', clave: uid, antes: '' });
    expect(JSON.parse(entrada.despues)).toEqual({ rol: 'directiva', estado: 'activo' });
    expect(JSON.stringify(entrada)).not.toContain('@');
  });

  it('dos altas tienen uids distintos', async () => {
    const { repo } = prepararAlta();
    const a = await repo.crear({ email: 'bea@example.com', rol: 'comunero' }, 'sistema:carga');
    const b = await repo.crear({ email: 'carla@example.com', rol: 'comunero' }, 'sistema:carga');
    expect(a).not.toBe(b);
  });

  it('si la auditoría falla, borra el alta y propaga el error', async () => {
    const { repo, filas, orden } = prepararAlta({ auditoriaFalla: true });
    await expect(repo.crear({ email: 'bea@example.com', rol: 'comunero' }, 'sistema:carga')).rejects.toThrow('Auditoria no disponible');
    const uid = orden[0]!.split(' ')[1];
    expect(orden).toEqual([`alta ${uid}`, `auditoria ${uid}`, `borrar ${uid}`]);
    expect(filas.map((f) => f.email)).toEqual(['ana@example.com']);
  });

  it('si tampoco puede borrar, lanza AltaUsuarioSinAuditar con el uid y sin el correo', async () => {
    const { repo } = prepararAlta({ auditoriaFalla: true, borrarFalla: true });
    const error = await repo.crear({ email: 'bea@example.com', rol: 'comunero' }, 'sistema:carga').catch((e: Error) => e);
    expect(error).toBeInstanceOf(AltaUsuarioSinAuditar);
    expect((error as Error).message).not.toContain('@');
  });
});
