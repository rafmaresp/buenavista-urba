// Reglas puras de la fusión automática (AGENTS.md, "Política de fusión"). Sin dependencias.
// Las usa fusion-automatica.mjs y las prueba fusion-lib.test.mjs.

/** Checks que tienen que estar en verde sobre el último commit del PR. */
export const REQUIRED_CHECKS = [
  'Secrets (TruffleHog)',
  'Vulnerabilities (Trivy)',
  'SAST (Semgrep)',
  'Tests & coverage floor',
  'e2e',
  'Revisor independiente',
];

/** Límite de líneas cambiadas (añadidas + borradas) sin contar lockfiles. */
export const MAX_LINES = 300;

/** Etiqueta para que un PR que cumple las condiciones no se fusione solo. */
export const OPT_OUT_LABEL = 'no-fusionar';

const LOCKFILES = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;

function escapeRegex(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** Convierte un patrón de CODEOWNERS (sintaxis tipo .gitignore) en RegExp sobre rutas del repo. */
export function codeownersPatternToRegex(pattern) {
  let p = pattern.trim();
  // Anclado a la raíz si empieza por "/" o tiene "/" en medio (como .gitignore).
  const anchored = p.startsWith('/') || p.replace(/\/$/, '').includes('/');
  p = p.replace(/^\//, '').replace(/\/$/, '');
  let body = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        body += '(?:.*/)?';
        i += 2;
      } else {
        body += '.*';
        i += 1;
      }
    } else if (c === '*') {
      body += '[^/]*';
    } else if (c === '?') {
      body += '[^/]';
    } else {
      body += escapeRegex(c);
    }
  }
  const prefix = anchored ? '' : '(?:.*/)?';
  // Un patrón que casa con un directorio cubre todo lo que hay debajo.
  return new RegExp(`^${prefix}${body}(?:/.*)?$`);
}

/** Lee CODEOWNERS y devuelve los patrones (primer campo de cada línea útil). */
export function parseCodeowners(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/)[0]);
}

/** Rutas cambiadas que caen en zona sensible según CODEOWNERS. */
export function sensitiveFiles(files, patterns) {
  const regexes = patterns.map((p) => ({ p, re: codeownersPatternToRegex(p) }));
  const out = [];
  for (const f of files) {
    const hit = regexes.find(({ re }) => re.test(f));
    if (hit) out.push(`${f} (${hit.p})`);
  }
  return out;
}

/** Líneas cambiadas sin lockfiles. `files` = [{ filename, additions, deletions }]. */
export function changedLines(files) {
  return files
    .filter((f) => !LOCKFILES.test(f.filename))
    .reduce((n, f) => n + f.additions + f.deletions, 0);
}

/**
 * Versión "mayor" de un rango semver de npm, para comparar. En 0.x el menor cuenta como mayor
 * (0.3 → 0.4 rompe). Devuelve null si no se entiende (git, url, *, latest...).
 */
export function majorOf(range) {
  const m = String(range).trim().match(/^[\^~>=<v\s]*(\d+)(?:\.(\d+|x|\*))?/);
  if (!m) return null;
  if (m[1] === '0') return m[2] && /^\d+$/.test(m[2]) ? `0.${m[2]}` : null;
  return m[1];
}

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * Cambios de dependencias que no son menores ni de parche: salto de mayor, dependencia nueva
 * o versión que no se entiende. Ante la duda, sensible.
 */
export function riskyDependencyChanges(basePkg, headPkg) {
  const out = [];
  for (const field of DEP_FIELDS) {
    const before = (basePkg && basePkg[field]) || {};
    const after = (headPkg && headPkg[field]) || {};
    for (const [name, range] of Object.entries(after)) {
      if (!(name in before)) {
        out.push(`${name} nueva (${range})`);
        continue;
      }
      if (before[name] === range) continue;
      const a = majorOf(before[name]);
      const b = majorOf(range);
      if (a === null || b === null || a !== b) out.push(`${name} ${before[name]} → ${range}`);
    }
  }
  return out;
}

/**
 * Estado de los checks del último commit. `runs` = [{ name, status, conclusion }] (los más
 * recientes por nombre). Devuelve { ready, pending, failed, missing }.
 */
export function evaluateChecks(runs, required = REQUIRED_CHECKS) {
  const ok = new Set(['success', 'skipped', 'neutral']);
  const pending = runs.filter((r) => r.status !== 'completed').map((r) => r.name);
  const failed = runs
    .filter((r) => r.status === 'completed' && !ok.has(r.conclusion))
    .map((r) => `${r.name} (${r.conclusion})`);
  const missing = required.filter(
    (name) => !runs.some((r) => r.name === name && r.status === 'completed' && r.conclusion === 'success'),
  );
  const missingNotPending = missing.filter((name) => !pending.includes(name));
  return {
    ready: pending.length === 0 && failed.length === 0 && missing.length === 0,
    pending,
    failed,
    missing: missingNotPending,
  };
}
