import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  changedLines,
  codeownersPatternToRegex,
  evaluateChecks,
  majorOf,
  parseCodeowners,
  REQUIRED_CHECKS,
  riskyDependencyChanges,
  sensitiveFiles,
} from './fusion-lib.mjs';

const patterns = parseCodeowners(readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8'));

test('las rutas sensibles del CODEOWNERS real se detectan', () => {
  const files = [
    'AGENTS.md',
    '.github/workflows/ci.yml',
    '.claude/skills/revisar-pr/SKILL.md',
    'specs/009-algo/spec.md',
    'api/src/functions/auth.ts',
    'api/src/lib/repo.ts',
    'web/src/app/core/auth.service.ts',
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
    'web/src/app/mapa/mapa.component.ts',
    'web/src/app/mapa/mapa.component.scss',
    'api/src/functions/health.ts',
    'e2e/tests/mapa.spec.ts',
    'web/package-lock.json',
  ];
  assert.deepEqual(sensitiveFiles(files, patterns), []);
});

test('un patrón anclado no casa fuera de la raíz', () => {
  assert.ok(codeownersPatternToRegex('/AGENTS.md').test('AGENTS.md'));
  assert.ok(!codeownersPatternToRegex('/AGENTS.md').test('docs/AGENTS.md'));
  assert.ok(codeownersPatternToRegex('/data/').test('data/x/y.csv'));
  assert.ok(!codeownersPatternToRegex('/data/').test('web/data/x.csv'));
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
  assert.equal(majorOf('>=22'), '22');
  assert.equal(majorOf('0.4.1'), '0.4');
  assert.equal(majorOf('latest'), null);
  assert.equal(majorOf('github:a/b'), null);
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
