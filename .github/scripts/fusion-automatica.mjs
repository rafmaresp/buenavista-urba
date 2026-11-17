// Fusión automática de PRs (AGENTS.md, "Política de fusión"). Lo ejecuta fusion-automatica.yml
// cuando termina la CI o el revisor de un PR. Nunca ejecuta código del PR: solo lee la API.
//
// Fusiona solo si: PR abierto, no borrador, de una rama claude/ del propio repo contra la rama
// por defecto, sin la etiqueta no-fusionar; todos los checks del último commit en verde (con el
// revisor incluido); ningún archivo en zona sensible (CODEOWNERS); sin saltos de versión mayor
// ni dependencias nuevas; y como mucho 300 líneas cambiadas sin lockfiles.
import { readFileSync, appendFileSync } from 'node:fs';
import {
  changedLines,
  evaluateChecks,
  MAX_LINES,
  OPT_OUT_LABEL,
  isNpmLockfile,
  parseCodeowners,
  riskyDependencyChanges,
  riskyLockfileChanges,
  sensitiveFiles,
} from './fusion-lib.mjs';

const { GITHUB_REPOSITORY: REPO, GITHUB_TOKEN, MERGE_TOKEN, HEAD_SHA, HEAD_BRANCH } = process.env;
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const MARKER = '<!-- fusion-automatica -->';

function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function gh(path, { token = GITHUB_TOKEN, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${path}: ${res.status} ${data?.message ?? ''}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function paginate(path, key) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await gh(`${path}${sep}per_page=100&page=${page}`);
    const items = key ? data[key] : data;
    out.push(...items);
    if (items.length < 100) return out;
  }
}

/** JSON de un archivo del repo en un commit (null si no existe). En crudo: vale para lockfiles grandes. */
async function jsonAt(path, ref) {
  const url = `${API}/repos/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${ref}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github.raw+json', 'x-github-api-version': '2022-11-28' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path}@${ref}: ${res.status}`);
  return JSON.parse(await res.text());
}

/** Crea o actualiza un único comentario del workflow en el PR. */
async function upsertComment(number, text) {
  const body = `${MARKER}\n${text}`;
  const comments = await paginate(`/repos/${REPO}/issues/${number}/comments`);
  const mine = comments.find((c) => c.user?.type === 'Bot' && c.body?.startsWith(MARKER));
  if (mine) {
    if (mine.body !== body) await gh(`/repos/${REPO}/issues/comments/${mine.id}`, { method: 'PATCH', body: { body } });
  } else {
    await gh(`/repos/${REPO}/issues/${number}/comments`, { method: 'POST', body: { body } });
  }
}

async function main() {
  if (!HEAD_BRANCH?.startsWith('claude/')) return summary(`Rama ${HEAD_BRANCH}: no es de Claude, no se fusiona sola.`);

  const prs = (await gh(`/repos/${REPO}/commits/${HEAD_SHA}/pulls`)).filter(
    (p) => p.state === 'open' && p.head.ref === HEAD_BRANCH && p.head.repo?.full_name === REPO,
  );
  if (prs.length === 0) return summary(`No hay PR abierto para ${HEAD_BRANCH} en ${HEAD_SHA}.`);

  const repo = await gh(`/repos/${REPO}`);
  for (const { number } of prs) {
    const pr = await gh(`/repos/${REPO}/pulls/${number}`);
    summary(`### PR #${number}`);
    if (pr.head.sha !== HEAD_SHA) {
      summary(`- El PR ya tiene otro commit (${pr.head.sha}); decidirá la ejecución de ese commit.`);
      continue;
    }
    if (pr.draft) { summary('- Borrador: no se fusiona.'); continue; }
    if (pr.base.ref !== repo.default_branch) { summary(`- Base ${pr.base.ref}: solo se fusiona contra ${repo.default_branch}.`); continue; }
    if (pr.labels.some((l) => l.name === OPT_OUT_LABEL)) { summary(`- Etiqueta ${OPT_OUT_LABEL}: lo fusiona Rafa.`); continue; }

    // Condiciones 1 y 2: CI y revisor en verde sobre el último commit.
    const runs = await paginate(`/repos/${REPO}/commits/${HEAD_SHA}/check-runs?filter=latest`, 'check_runs');
    const checks = evaluateChecks(runs);
    if (!checks.ready) {
      if (checks.pending.length) summary(`- Pendientes: ${checks.pending.join(', ')}.`);
      if (checks.failed.length) summary(`- En rojo: ${checks.failed.join(', ')}.`);
      if (checks.missing.length) summary(`- Sin ejecutar: ${checks.missing.join(', ')}.`);
      continue;
    }

    // Condición 3: sin zonas sensibles.
    const files = await paginate(`/repos/${REPO}/pulls/${number}/files`);
    const names = files.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean));
    const patterns = parseCodeowners(readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8'));
    const reasons = sensitiveFiles(names, patterns).map((f) => `zona sensible: \`${f}\``);
    for (const f of files.filter((f) => /(^|\/)package\.json$/.test(f.filename))) {
      const before = await jsonAt(f.previous_filename ?? f.filename, pr.base.sha);
      const after = await jsonAt(f.filename, HEAD_SHA);
      for (const d of riskyDependencyChanges(before, after)) reasons.push(`dependencia en \`${f.filename}\`: ${d}`);
    }
    for (const f of files.filter((f) => isNpmLockfile(f.filename))) {
      const before = await jsonAt(f.previous_filename ?? f.filename, pr.base.sha);
      const after = await jsonAt(f.filename, HEAD_SHA);
      const risks = riskyLockfileChanges(before, after);
      risks.slice(0, 5).forEach((d) => reasons.push(`lockfile \`${f.filename}\`: ${d}`));
      if (risks.length > 5) reasons.push(`lockfile \`${f.filename}\`: … y ${risks.length - 5} más`);
    }
    // Otros lockfiles (yarn, pnpm) no se analizan: son sensibles.
    for (const f of files.filter((f) => /(^|\/)(yarn\.lock|pnpm-lock\.yaml)$/.test(f.filename))) {
      reasons.push(`lockfile no analizable: \`${f.filename}\``);
    }
    const lines = changedLines(files);
    if (lines > MAX_LINES) reasons.push(`${lines} líneas cambiadas sin lockfiles (máximo ${MAX_LINES})`);

    if (reasons.length) {
      reasons.forEach((r) => summary(`- ${r}`));
      await upsertComment(
        number,
        `**Fusión automática: no.** CI y revisor en verde, pero este PR lo fusiona Rafa (política de fusión de \`AGENTS.md\`):\n\n${reasons
          .slice(0, 20)
          .map((r) => `- ${r}`)
          .join('\n')}${reasons.length > 20 ? `\n- … y ${reasons.length - 20} más` : ''}`,
      );
      continue;
    }

    if (!MERGE_TOKEN) {
      summary('- Cumple la política, pero falta el secreto PR_TOKEN: lo fusiona Rafa.');
      continue;
    }
    // Con el token de Rafa (no GITHUB_TOKEN) para que el push a main dispare el despliegue.
    await gh(`/repos/${REPO}/pulls/${number}/merge`, {
      token: MERGE_TOKEN,
      method: 'PUT',
      body: { merge_method: 'merge', sha: HEAD_SHA },
    });
    summary(`- Fusionado (${lines} líneas).`);
    await upsertComment(
      number,
      `**Fusionado automáticamente.** CI y revisor independiente en verde sobre \`${HEAD_SHA.slice(0, 7)}\`, sin zonas sensibles y ${lines} líneas cambiadas. Para deshacerlo, revierte este PR.`,
    );
  }
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
