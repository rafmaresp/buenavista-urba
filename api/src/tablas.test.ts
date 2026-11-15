import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLAS, tablaClient, variableDeConexion } from './tablas';

const bicep = readFileSync(join(__dirname, '..', '..', 'infra', 'main.bicep'), 'utf8');

function tablasDelBicep(): string[] {
  const patron =
    /resource\s+\w+\s+'Microsoft\.Storage\/storageAccounts\/tableServices\/tables@[^']+'\s*=\s*\{[^}]*?name:\s*'(\w+)'/g;
  return [...bicep.matchAll(patron)].map((m) => m[1]!);
}

describe('tablas', () => {
  it('las tablas del código son exactamente las declaradas en infra/main.bicep', () => {
    expect(tablasDelBicep().sort()).toEqual([...TABLAS].sort());
  });

  it('cada tabla tiene su app setting con un SAS de servicio en infra/main.bicep', () => {
    for (const tabla of TABLAS) {
      expect(bicep).toMatch(new RegExp(`^\\s+${variableDeConexion(tabla)}:\\s*'TableEndpoint=`, 'm'));
    }
  });

  it('la app ya no recibe el SAS de cuenta', () => {
    expect(bicep).not.toMatch(/TABLES_CONNECTION/);
    expect(bicep).not.toMatch(/listAccountSas/);
  });

  it('el SAS de Auditoria solo permite añadir y leer, el de Farolas solo leer, el de Usuarios leer y actualizar y el de Incidencias leer, añadir, actualizar y borrar', () => {
    const permisos = [...bicep.matchAll(/toLower\((tabla\w+)\.name\)\}'\s*signedPermission:\s*'(\w+)'/g)].map(
      (m) => [m[1]!, m[2]!] as const,
    );
    expect(Object.fromEntries(permisos)).toEqual({ tablaFarolas: 'r', tablaAuditoria: 'ra', tablaUsuarios: 'ru', tablaIncidencias: 'raud' });
  });

  it('sin app setting falla con un error que no incluye ningún valor', () => {
    expect(() => tablaClient('Farolas', {})).toThrow('Falta el app setting FAROLAS_CONNECTION');
  });
});
