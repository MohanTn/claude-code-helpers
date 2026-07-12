#!/usr/bin/env node
/**
 * arch-inject.js — Injects a "shared understanding" document into the HTML template.
 *
 * The document exists to SYNC MENTAL MODELS between a human and the AI, and it is
 * CO-AUTHORED: the AI states its understanding, and the human confirms, corrects,
 * forks, resolves tensions, signs off examples, and adds claims the AI missed —
 * all exported back as a structured review that drives the next pass. It is not an
 * implementation spec; the implementation sketch is last and non-binding.
 *
 * The template is filled from these inputs:
 *   - understanding[]  → Section 5 checklist. Each claim gets ✓/≈/✗ verdicts, or,
 *                        if it carries `alternatives`, radio FORK options. Optional
 *                        `options` become structured-correction choices. Risky claims
 *                        (uncertain × impactful, and all forks) are flagged priority.
 *   - tensions[]       → Section 6. Conflicts the AI found between the user's intent
 *                        and what the code allows, each with resolution options.
 *   - examples[]       → Section 4. Given/When/Then acceptance examples (and
 *                        counter-examples) the human signs off; approved ones are the
 *                        binding behavioural contract.
 *   - openQuestions[]  → Section 8 interactive table.
 *   - revisionLog[]    → Section 0.
 *   - sections{}       → free-form HTML for sections 1,2,3,7,9,10.
 *
 * IMPORTANT: All diagrams MUST use Mermaid syntax in <div class="mermaid">…</div>;
 * the template auto-renders them. Escape newlines in JSON strings as \\n.
 *
 * Usage: node arch-inject.js <input-json> <output-html> [template-path]
 *
 * See claude/commands/arch.md / copilot/skills/arch/SKILL.md for the full JSON schema.
 */

const fs = require('fs');
const path = require('path');

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function loadTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

function buildRevisionLogHtml(entries) {
  return entries
    .map(entry => `<tr><td>${escapeHtml(entry.version)}</td><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(entry.summary)}</td><td>${escapeHtml(entry.drivenBy)}</td></tr>`)
    .join('\n');
}

// Source and confidence render as coloured badges. Unknown values fall back to the
// most cautious option (assumed / low) so a mis-tagged claim draws MORE scrutiny.
const SOURCE_BADGES = {
  user: { cls: 'src-user', label: 'you said' },
  code: { cls: 'src-code', label: 'in code' },
  inferred: { cls: 'src-inferred', label: 'inferred' },
  assumed: { cls: 'src-assumed', label: 'assumed' }
};
const CONFIDENCE_BADGES = {
  high: { cls: 'conf-high', label: 'high' },
  medium: { cls: 'conf-medium', label: 'medium' },
  low: { cls: 'conf-low', label: 'low' }
};

function badgeHtml(table, value, fallbackKey) {
  const badge = table[String(value || '').toLowerCase()] || table[fallbackKey];
  return `<span class="badge ${badge.cls}">${badge.label}</span>`;
}

// A claim is "high priority" (must be verdicted before approval) when it is a fork
// (an unresolved either/or) or when it is uncertain AND impactful — the quadrant
// where silent agreement causes non-compliant code.
function isHighPriority(entry) {
  if (Array.isArray(entry.alternatives) && entry.alternatives.length) return true;
  const conf = String(entry.confidence || '').toLowerCase();
  const src = String(entry.source || '').toLowerCase();
  const uncertain = conf === 'low' || conf === 'medium' || src === 'assumed';
  const impactLevel = String(entry.impactLevel || (entry.impact ? 'medium' : 'low')).toLowerCase();
  const impactful = impactLevel === 'high' || impactLevel === 'medium';
  return uncertain && impactful;
}

function buildUnderstandingHtml(entries) {
  return entries
    .map(entry => {
      const id = escapeHtml(entry.id);
      const priority = isHighPriority(entry) ? 'high' : '';
      const isFork = Array.isArray(entry.alternatives) && entry.alternatives.length > 0;

      const evidence = entry.evidence
        ? `<div class="u-evidence">📎 ${escapeHtml(entry.evidence)}</div>`
        : '';
      const impact = entry.impact
        ? `<div class="u-impact">⚠ If wrong: ${escapeHtml(entry.impact)}</div>`
        : '';
      const flag = priority
        ? `<div class="priority-flag">⚠ high stakes · confirm first</div>`
        : '';
      const forkHint = isFork
        ? `<div class="fork-hint">I can read this more than one way — pick the intended one:</div>`
        : '';

      let verdictCell;
      if (isFork) {
        const opts = entry.alternatives
          .map((alt, i) => `<label class="fork-opt"><input type="radio" name="fork-${id}" value="${i}"><span>${escapeHtml(alt)}</span></label>`)
          .join('');
        verdictCell =
          `<td class="u-verdict u-fork">${opts}` +
          `<label class="fork-opt fork-neither"><input type="radio" name="fork-${id}" value="neither"><span>neither — I'll explain</span></label>` +
          `<textarea class="u-note" name="note-${id}" rows="2" placeholder="The right reading is…" hidden></textarea></td>`;
      } else {
        const optionButtons = (Array.isArray(entry.options) && entry.options.length)
          ? `<div class="correction-options"><span class="correction-label">Right answer:</span>` +
            entry.options.map(o => `<button type="button" class="correction-opt" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('') +
            `</div>`
          : '';
        verdictCell =
          `<td class="u-verdict"><div class="verdict-group">` +
          `<button type="button" class="verdict-btn v-yes" data-verdict="yes" title="Correct">✓</button>` +
          `<button type="button" class="verdict-btn v-partly" data-verdict="partly" title="Partly right">≈</button>` +
          `<button type="button" class="verdict-btn v-no" data-verdict="no" title="Wrong">✗</button>` +
          `</div><div class="u-correction" hidden>${optionButtons}` +
          `<textarea class="u-note" name="note-${id}" rows="2" placeholder="What's off? Correct me…"></textarea></div></td>`;
      }

      return (
        `<tr data-id="${id}" data-statement="${escapeHtml(entry.statement)}"${isFork ? ' data-fork="true"' : ''}${priority ? ' data-priority="high"' : ''}>` +
        `<td>${id}</td>` +
        `<td>${escapeHtml(entry.area || '')}</td>` +
        `<td class="u-statement"><div>${escapeHtml(entry.statement)}</div>${evidence}${impact}${forkHint}${flag}</td>` +
        `<td>${badgeHtml(SOURCE_BADGES, entry.source, 'assumed')}</td>` +
        `<td>${badgeHtml(CONFIDENCE_BADGES, entry.confidence, 'low')}</td>` +
        verdictCell +
        `</tr>`
      );
    })
    .join('\n');
}

function buildTensionsHtml(entries) {
  if (!entries.length) {
    return `<p class="u-hint">No tensions surfaced this pass — your intent and the code agree so far.</p>`;
  }
  return entries
    .map(t => {
      const id = escapeHtml(t.id);
      const evidence = t.evidence ? `<div class="u-evidence">📎 ${escapeHtml(t.evidence)}</div>` : '';
      const rec = t.recommendation
        ? `<div class="tension-rec"><strong>My recommendation:</strong> ${escapeHtml(t.recommendation)}</div>`
        : '';
      const opts = (Array.isArray(t.options) ? t.options : [])
        .map((o, i) => `<label class="tension-opt"><input type="radio" name="tension-${id}" value="${i}"><span>${escapeHtml(o)}</span></label>`)
        .join('');
      return (
        `<div class="card tension-card" data-id="${id}" data-summary="${escapeHtml((t.youWant || '') + ' — vs — ' + (t.butCode || ''))}">` +
        `<div class="tension-head"><span class="badge tension-badge">${id}</span> Tension I found</div>` +
        `<div class="tension-cols">` +
        `<div class="tension-col want"><h4>You want</h4><p>${escapeHtml(t.youWant || '')}</p></div>` +
        `<div class="tension-col code"><h4>But the code…</h4><p>${escapeHtml(t.butCode || '')}</p>${evidence}</div>` +
        `</div>${rec}` +
        `<div class="tension-resolve"><span class="resolve-label">Your call:</span>${opts}` +
        `<label class="tension-opt"><input type="radio" name="tension-${id}" value="other"><span>other →</span></label>` +
        `<textarea class="t-note" name="tnote-${id}" rows="2" placeholder="How we should resolve it…" hidden></textarea></div>` +
        `</div>`
      );
    })
    .join('\n');
}

function buildExamplesHtml(entries) {
  if (!entries.length) {
    return `<p class="u-hint">No acceptance examples yet.</p>`;
  }
  return entries
    .map(e => {
      const id = escapeHtml(e.id);
      const kind = String(e.kind || 'example').toLowerCase() === 'counter' ? 'counter' : 'example';
      const kindLabel = kind === 'counter' ? 'must NOT happen' : 'must happen';
      const refs = (Array.isArray(e.claims) && e.claims.length)
        ? `<div class="ex-refs">Pins claims: ${e.claims.map(c => escapeHtml(c)).join(', ')}</div>`
        : '';
      const exText = `Given ${e.given || ''}; When ${e.when || ''}; Then ${e.then || ''}`;
      return (
        `<div class="card example-card ex-${kind}" data-id="${id}" data-example="${escapeHtml(exText)}">` +
        `<div class="ex-head"><span class="badge kind-${kind}">${id} · ${kindLabel}</span>` +
        `<div class="verdict-group ex-verdict">` +
        `<button type="button" class="verdict-btn v-yes" data-verdict="yes" title="Right — this is the behaviour I want">✓</button>` +
        `<button type="button" class="verdict-btn v-no" data-verdict="no" title="Wrong outcome">✗</button>` +
        `</div></div>` +
        `<div class="ex-gwt">` +
        `<div><span class="gwt-k">Given</span> ${escapeHtml(e.given || '')}</div>` +
        `<div><span class="gwt-k">When</span> ${escapeHtml(e.when || '')}</div>` +
        `<div><span class="gwt-k">Then</span> ${escapeHtml(e.then || '')}</div>` +
        `</div>${refs}` +
        `<textarea class="ex-note" name="exnote-${id}" rows="2" placeholder="What should the outcome be instead?" hidden></textarea>` +
        `</div>`
      );
    })
    .join('\n');
}

function buildOpenQuestionsHtml(entries) {
  return entries
    .map(entry => `<tr data-id="${escapeHtml(entry.id)}"><td>${escapeHtml(entry.id)}</td><td>${escapeHtml(entry.question)}</td><td>${escapeHtml(entry.whyItMatters)}</td><td>${escapeHtml(entry.proposedDefault)}</td><td>${escapeHtml(entry.status)}</td><td><textarea class="oq-answer" name="answer-${escapeHtml(entry.id)}" rows="2" placeholder="Type your answer…"></textarea></td></tr>`)
    .join('\n');
}

function injectContent(template, config) {
  let html = template;

  // Replacement values go through a function so `$&`, `$'`, `$1` etc. in the
  // content are kept literal instead of being expanded by String.replace.
  const put = (pattern, value) => {
    html = html.replace(pattern, () => value);
  };

  // Feature-level metadata (escaped; some land inside HTML attributes).
  put(/{{FEATURE_TITLE}}/g, escapeHtml(config.title));
  put(/{{FEATURE_SUMMARY}}/g, escapeHtml(config.summary));
  put(/{{STACK_BADGES}}/g, escapeHtml(config.stack));

  // Document-control metadata (escaped).
  put(/{{STATUS}}/g, escapeHtml(config.status));
  put(/{{STATUS_CLASS}}/g, escapeHtml(config.statusClass));
  put(/{{VERSION}}/g, escapeHtml(config.version));
  put(/{{LAST_UPDATED}}/g, escapeHtml(config.lastUpdated));
  put(/{{AUTHOR_MODEL}}/g, escapeHtml(config.authorModel));

  // AI overview (raw HTML fragment, same trust level as sections).
  put(/{{AI_OVERVIEW_CONTENT}}/g, config.aiOverview || '');

  // Structured, co-authored surfaces (fields escaped inside the builders).
  put(/{{REVISION_LOG_ROWS}}/g, buildRevisionLogHtml(config.revisionLog || []));
  put(/{{UNDERSTANDING_ROWS}}/g, buildUnderstandingHtml(config.understanding || []));
  put(/{{TENSIONS_CONTENT}}/g, buildTensionsHtml(config.tensions || []));
  put(/{{EXAMPLES_CONTENT}}/g, buildExamplesHtml(config.examples || []));
  put(/{{OPEN_QUESTIONS_ROWS}}/g, buildOpenQuestionsHtml(config.openQuestions || []));

  // Free-form section content (raw HTML). Sections 4/5/6/8 are the structured
  // surfaces above and have no {{SECTION_N_CONTENT}} slot, so stray keys are ignored.
  const sections = config.sections || {};
  for (let i = 1; i <= 10; i++) {
    put(new RegExp(`{{SECTION_${i}_CONTENT}}`, 'g'), sections[`${i}`] || '');
  }

  return html;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node arch-inject.js <input-json> <output-html> [template-path]');
    console.error('');
    console.error('Arguments:');
    console.error('  <input-json>    JSON with understanding claims, tensions, acceptance examples,');
    console.error('                  open questions, and section HTML fragments');
    console.error('  <output-html>   Path to write the final shared-understanding document');
    console.error('  [template-path] HTML template (default: arch-template.html next to this script)');
    console.error('');
    console.error('The doc is co-authored: the human confirms/corrects/forks claims, resolves tensions,');
    console.error('signs off examples, and adds missed claims, then exports a review for the next pass.');
    console.error('Wrap diagrams in <div class="mermaid">…</div> (newlines as \\\\n); the template renders them.');
    process.exit(1);
  }

  const inputJsonPath = args[0];
  const outputHtmlPath = args[1];
  const templatePath = args[2] || path.join(__dirname, 'arch-template.html');

  try {
    if (!fs.existsSync(inputJsonPath)) {
      throw new Error(`Input JSON not found: ${inputJsonPath}`);
    }
    const config = JSON.parse(fs.readFileSync(inputJsonPath, 'utf-8'));
    const template = loadTemplate(templatePath);
    const html = injectContent(template, config);
    fs.writeFileSync(outputHtmlPath, html, 'utf-8');
    console.log(`✓ Generated: ${outputHtmlPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  escapeHtml,
  isHighPriority,
  buildRevisionLogHtml,
  buildUnderstandingHtml,
  buildTensionsHtml,
  buildExamplesHtml,
  buildOpenQuestionsHtml,
  injectContent,
  loadTemplate
};
