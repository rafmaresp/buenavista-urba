import { describe, expect, it } from 'vitest';
import { UID_ANA, auditoriaDoble, filaAna, tablaUsuarios } from './pruebas/usuarios-dobles';
import { RepositorioUsuarios, VinculacionSinAuditar } from './usuarios-repo';

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
