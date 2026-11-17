import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  changedLines,
  evaluateChecks,
  majorOf,
  matchesCodeowners,
  parseCodeowners,
  REQUIRED_CHECKS,
  riskyDependencyChanges,
  riskyLockfileChanges,
  sensitiveFiles,
} from './fusion-lib.mjs';

const patterns = parseCodeowners(readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8'));

test('las rutas sensibles del CODEOWNERS real se detectan', () => {
  const files = [
    'AGENTS.md',
    '.github/workflows/ci.yml',
    '.claude/skills/revisar-pr/SKILL.md',
    'specs/009-algo/spec.md',
    'api/src/identidad.ts',
    'api/src/yo.ts',
    'api/src/functions/yo.ts',
    'api/src/tablas.ts',
    'api/src/farolas-repo.ts',
    'api/src/incidencias-repo.ts',
    'api/src/usuarios.ts',
    'api/src/functions/farola-reubicar.ts',
    'api/src/pruebas/usuarios-dobles.ts',
    'web/src/app/sesion.ts',
    'web/src/app/gis.ts',
    'web/src/app/login/login.ts',
    'web/src/app/privacidad/privacidad.html',
    'data/farolas_buenavista.csv',
    'docs/rgpd/propuesta-rgpd-v1.md',
    'web/src/app/capas/redes-tuberias.ts',
    'infra/main.bicep',
    'web/public/staticwebapp.config.json',
    'docs/decisions/registro.md',
  ];
  assert.equal(sensitiveFiles(files, patterns).length, files.length);
});

test('las rutas normales no son sensibles', () => {
  const files = [
    'README.md',
    'docs/producto.md',
    'web/src/app/mapa/mapa-farolas.ts',
    'web/src/app/mapa/mapa-farolas.html',
    'web/src/app/mapa/capas.ts',
    'api/src/identidad.test.ts',
    'api/src/carga-farolas.integration.test.ts',
    'e2e/tests/mapa.spec.ts',
    'web/package-lock.json',
  ];
  assert.deepEqual(sensitiveFiles(files, patterns), []);
});

test('un patrón anclado no casa fuera de la raíz', () => {
  assert.ok(matchesCodeowners('/AGENTS.md', 'AGENTS.md'));
  assert.ok(!matchesCodeowners('/AGENTS.md', 'docs/AGENTS.md'));
  assert.ok(matchesCodeowners('/data/', 'data/x/y.csv'));
  assert.ok(!matchesCodeowners('/data/', 'web/data/x.csv'));
  assert.ok(matchesCodeowners('/api/src/**/auth*', 'api/src/auth.ts'));
  assert.ok(!matchesCodeowners('/api/src/**/auth*', 'api/src/lib/oauthless.ts'));
});

test('las líneas cambiadas no cuentan lockfiles', () => {
  const n = changedLines([
    { filename: 'web/src/a.ts', additions: 10, deletions: 5 },
    { filename: 'web/package-lock.json', additions: 900, deletions: 800 },
  ]);
  assert.equal(n, 15);
});

test('majorOf entiende rangos habituales', () => {
  assert.equal(majorOf('^20.1.0'), '20');
  assert.equal(majorOf('~5.4.2'), '5');
  assert.equal(majorOf('0.4.1'), '0.4');
  assert.equal(majorOf('22.0.0-rc.1'), '22');
  for (const r of ['>=3.22.0', '^1.9.3 || ^2.0.0', '1.0.0 - 2.0.0', '1.x', '*', 'latest', 'github:a/b', '<2.0.0', '^1']) {
    assert.equal(majorOf(r), null, r);
  }
});

test('solo los cambios menores o de parche de dependencias pasan', () => {
  const base = { dependencies: { leaflet: '^1.9.3', zod: '^3.22.0', tiny: '0.3.1' }, devDependencies: { vitest: '^3.0.0' } };
  assert.deepEqual(
    riskyDependencyChanges(base, { dependencies: { leaflet: '^1.9.4', zod: '^3.23.0', tiny: '0.3.2' }, devDependencies: { vitest: '^3.2.1' } }),
    [],
  );
  assert.equal(riskyDependencyChanges(base, { ...base, devDependencies: { vitest: '^4.0.0' } }).length, 1);
  assert.equal(riskyDependencyChanges(base, { ...base, dependencies: { ...base.dependencies, tiny: '0.4.0' } }).length, 1);
  assert.equal(riskyDependencyChanges(base, { ...base, dependencies: { ...base.dependencies, nueva: '^1.0.0' } }).length, 1);
  assert.equal(riskyDependencyChanges(base, { ...base, dependencies: { ...base.dependencies, zod: '>=3.22.0' } }).length, 1);
  // Quitar una dependencia no es un riesgo de versión.
  assert.deepEqual(riskyDependencyChanges(base, { dependencies: { leaflet: '^1.9.3', zod: '^3.22.0', tiny: '0.3.1' } }), []);
});

const green = REQUIRED_CHECKS.map((name) => ({ name, status: 'completed', conclusion: 'success' }));

test('todos los checks en verde, con jobs saltados, está listo', () => {
  const r = evaluateChecks([...green, { name: 'claude', status: 'completed', conclusion: 'skipped' }]);
  assert.equal(r.ready, true);
});

test('el revisor en marcha deja el PR pendiente, no fallido', () => {
  const runs = green.map((c) => (c.name === 'Revisor independiente' ? { ...c, status: 'in_progress', conclusion: null } : c));
  const r = evaluateChecks(runs);
  assert.equal(r.ready, false);
  assert.deepEqual(r.pending, ['Revisor independiente']);
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.missing, []);
});

test('un check en rojo o un check obligatorio ausente bloquea', () => {
  const rojo = evaluateChecks(green.map((c) => (c.name === 'e2e' ? { ...c, conclusion: 'failure' } : c)));
  assert.equal(rojo.ready, false);
  assert.deepEqual(rojo.failed, ['e2e (failure)']);

  const sinRevisor = evaluateChecks(green.filter((c) => c.name !== 'Revisor independiente'));
  assert.equal(sinRevisor.ready, false);
  assert.deepEqual(sinRevisor.missing, ['Revisor independiente']);

  const revisorSaltado = evaluateChecks(
    green.map((c) => (c.name === 'Revisor independiente' ? { ...c, conclusion: 'skipped' } : c)),
  );
  assert.equal(revisorSaltado.ready, false);
});

test('cambiar scripts, overrides o engines de un package.json es sensible', () => {
  const base = { scripts: { test: 'ng test --no-watch' }, dependencies: { leaflet: '^1.9.3' } };
  assert.deepEqual(riskyDependencyChanges(base, structuredClone(base)), []);
  assert.deepEqual(riskyDependencyChanges(base, { ...base, scripts: { test: 'true' } }), ['cambia `scripts`']);
  assert.deepEqual(riskyDependencyChanges(base, { ...base, overrides: { leaflet: '2.0.0' } }), ['cambia `overrides`']);
  assert.deepEqual(riskyDependencyChanges(base, { ...base, engines: { node: '>=24' } }), ['cambia `engines`']);
});

test('la configuración de la CI es zona sensible', () => {
  const files = ['quality.config.json', 'api/vitest.config.ts', 'web/angular.json', 'e2e/playwright.config.ts', '.semgrepignore'];
  assert.equal(sensitiveFiles(files, patterns).length, files.length);
});

test('una línea sin dueños posterior quita la zona (manda la última que casa)', () => {
  const rules = parseCodeowners('/api/src/ @rafa\n/api/src/**/*.test.ts\n');
  assert.deepEqual(sensitiveFiles(['api/src/a.ts', 'api/src/x/b.test.ts'], rules), ['api/src/a.ts (/api/src/)']);
});

const reg = (n, v) => `https://registry.npmjs.org/${n}/-/${n}-${v}.tgz`;
const lock = (pkgs) => ({ lockfileVersion: 3, packages: { '': { name: 'web' }, ...pkgs } });

test('lockfile: un parche desde npm pasa; quitar paquetes también', () => {
  const base = lock({ 'node_modules/zod': { version: '3.22.0', resolved: reg('zod', '3.22.0'), integrity: 'sha512-a' }, 'node_modules/old': { version: '1.0.0', resolved: reg('old', '1.0.0'), integrity: 'sha512-o' } });
  const head = lock({ 'node_modules/zod': { version: '3.23.1', resolved: reg('zod', '3.23.1'), integrity: 'sha512-b' } });
  assert.deepEqual(riskyLockfileChanges(base, head), []);
});

test('lockfile: paquete nuevo, mayor, tarball cambiado o de fuera de npm es sensible', () => {
  const zod = { version: '3.22.0', resolved: reg('zod', '3.22.0'), integrity: 'sha512-a' };
  const base = lock({ 'node_modules/zod': zod });
  assert.equal(riskyLockfileChanges(base, lock({ 'node_modules/zod': zod, 'node_modules/x': { version: '1.0.0' } })).length, 1);
  assert.equal(riskyLockfileChanges(base, lock({ 'node_modules/zod': { version: '4.0.0', resolved: reg('zod', '4.0.0'), integrity: 'sha512-c' } })).length, 1);
  assert.equal(riskyLockfileChanges(base, lock({ 'node_modules/zod': { ...zod, integrity: 'sha512-z' } })).length, 1);
  assert.equal(riskyLockfileChanges(base, lock({ 'node_modules/zod': { ...zod, resolved: 'https://example.org/x.tgz' } })).length, 2);
  assert.equal(riskyLockfileChanges(base, lock({ 'node_modules/zod': { version: '3.22.1', resolved: 'https://example.org/x.tgz', integrity: 'sha512-q' } })).length, 1);
  assert.equal(riskyLockfileChanges(base, { lockfileVersion: 1, dependencies: {} }).length, 1);
});
