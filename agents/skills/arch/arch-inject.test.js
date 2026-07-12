#!/usr/bin/env node
// Unit tests for arch-inject.js. Run with: node --test agents/skills/arch/arch-inject.test.js

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  escapeHtml,
  isHighPriority,
  buildRevisionLogHtml,
  buildUnderstandingHtml,
  buildTensionsHtml,
  buildExamplesHtml,
  buildOpenQuestionsHtml,
  injectContent,
  loadTemplate
} = require('./arch-inject.js');

const TEMPLATE_PATH = path.join(__dirname, 'arch-template.html');

function sampleConfig(overrides = {}) {
  return {
    title: 'Sample Feature',
    summary: 'A test summary',
    stack: 'Node.js · React',
    status: 'DRAFT',
    statusClass: 'draft',
    version: 'v1',
    lastUpdated: '2026-07-12',
    authorModel: 'Claude Opus 4.8',
    aiOverview: '<p>Condensed summary of what the user wants.</p>',
    revisionLog: [
      { version: 'v1', date: '2026-07-12', summary: 'Initial understanding', drivenBy: 'First pass' }
    ],
    understanding: [
      {
        id: 'U1',
        area: 'Concept',
        statement: 'The doc must prove the AI understands before coding.',
        source: 'user',
        confidence: 'high',
        evidence: 'arch-inject.js:80',
        impact: 'Wrong goal means every section is aimed wrong.'
      },
      {
        id: 'U2',
        area: 'Change',
        statement: 'How should retries stop?',
        source: 'inferred',
        confidence: 'low',
        alternatives: ['Stop when the invoice is paid by any means', 'Stop only after N attempts']
      },
      {
        id: 'U3',
        area: 'Code',
        statement: 'Charges are created in charges.js.',
        source: 'code',
        confidence: 'medium',
        options: ['charges.js', 'billing.js', 'stripe.js']
      }
    ],
    tensions: [
      {
        id: 'T1',
        youWant: 'Instant refunds',
        butCode: 'The gateway settles nightly',
        evidence: 'gateway.js:12',
        options: ['Accept next-day refunds', 'Add a ledger to fake instant'],
        recommendation: 'Accept next-day refunds'
      }
    ],
    examples: [
      { id: 'E1', kind: 'example', given: 'invoice paid by transfer', when: 'a retry is scheduled', then: 'the retry is cancelled', claims: ['U2'] },
      { id: 'E2', kind: 'counter', given: 'a paid invoice', when: 'the nightly job runs', then: 'the card is charged again' }
    ],
    openQuestions: [
      { id: 'OQ1', question: 'Should sessions expire after 15 or 30 minutes?', whyItMatters: 'Impacts UX', proposedDefault: '15 minutes', status: 'Open' }
    ],
    sections: {
      '1': '<div class="card"><p>Section one</p></div>',
      '2': '<div class="mermaid-card"><div class="mermaid">flowchart LR\n  A --> B</div></div>'
    },
    ...overrides
  };
}

test('escapeHtml escapes all HTML-sensitive characters', () => {
  assert.strictEqual(
    escapeHtml(`<b>"x" & 'y'</b>`),
    '&lt;b&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/b&gt;'
  );
});

test('isHighPriority flags forks and uncertain-but-impactful claims', () => {
  assert.strictEqual(isHighPriority({ alternatives: ['a', 'b'], confidence: 'high' }), true, 'forks are always high priority');
  assert.strictEqual(isHighPriority({ confidence: 'low', impactLevel: 'high' }), true);
  assert.strictEqual(isHighPriority({ confidence: 'medium', impact: 'breaks billing' }), true, 'impact text implies medium impact');
  assert.strictEqual(isHighPriority({ confidence: 'high', impactLevel: 'high' }), false, 'certain claims are not danger-zone');
  assert.strictEqual(isHighPriority({ confidence: 'low' }), false, 'uncertain but no impact is not danger-zone');
});

test('buildRevisionLogHtml renders one escaped row per entry', () => {
  const rows = buildRevisionLogHtml([
    { version: 'v1', date: '2026-07-12', summary: 'Added <script>', drivenBy: 'User' },
    { version: 'v2', date: '2026-07-13', summary: 'Fix', drivenBy: 'Review' }
  ]);
  assert.strictEqual(rows.split('<tr>').length - 1, 2);
  assert.ok(rows.includes('&lt;script&gt;'));
  assert.ok(!rows.includes('<script>'));
});

test('buildUnderstandingHtml renders verdicts, escaped statement, and data attributes', () => {
  const rows = buildUnderstandingHtml([
    { id: 'U1', area: 'Concept', statement: 'Sync <the> models', source: 'user', confidence: 'high' }
  ]);
  assert.strictEqual(rows.split('class="verdict-btn').length - 1, 3);
  assert.ok(rows.includes('data-statement="Sync &lt;the&gt; models"'));
  assert.ok(!rows.includes('Sync <the> models'));
  assert.ok(rows.includes('data-id="U1"'));
});

test('buildUnderstandingHtml renders a fork as radios with a neither option and no verdict buttons', () => {
  const rows = buildUnderstandingHtml([
    { id: 'U2', statement: 'How should X behave?', source: 'inferred', confidence: 'low', alternatives: ['Option A', 'Option B'] }
  ]);
  assert.ok(rows.includes('data-fork="true"'));
  assert.ok(rows.includes('data-priority="high"'), 'forks are high priority');
  assert.strictEqual(rows.split('type="radio"').length - 1, 3, 'two alternatives + neither');
  assert.ok(rows.includes('Option A') && rows.includes('Option B'));
  assert.ok(rows.includes('value="neither"'));
  assert.ok(!rows.includes('class="verdict-btn'), 'forks replace verdict buttons');
});

test('buildUnderstandingHtml renders structured-correction options for non-fork claims', () => {
  const rows = buildUnderstandingHtml([
    { id: 'U3', statement: 'File is charges.js', source: 'code', confidence: 'medium', options: ['charges.js', 'billing.js'] }
  ]);
  assert.strictEqual(rows.split('class="correction-opt"').length - 1, 2);
  assert.ok(rows.includes('data-value="charges.js"'));
});

test('buildUnderstandingHtml maps known source/confidence to badges and falls back cautiously', () => {
  const known = buildUnderstandingHtml([{ id: 'U1', statement: 's', source: 'code', confidence: 'high' }]);
  assert.ok(known.includes('badge src-code') && known.includes('badge conf-high'));
  const unknown = buildUnderstandingHtml([{ id: 'U1', statement: 's', source: 'wat', confidence: 'bogus' }]);
  assert.ok(unknown.includes('badge src-assumed') && unknown.includes('badge conf-low'));
});

test('buildTensionsHtml renders want/code columns, options, and a summary attribute', () => {
  const html = buildTensionsHtml([
    { id: 'T1', youWant: 'Fast', butCode: 'Slow <gateway>', options: ['a', 'b'], recommendation: 'a' }
  ]);
  assert.ok(html.includes('data-id="T1"'));
  assert.ok(html.includes('You want') && html.includes('But the code'));
  assert.strictEqual(html.split('type="radio"').length - 1, 3, 'two options + other');
  assert.ok(html.includes('My recommendation'));
  assert.ok(html.includes('Slow &lt;gateway&gt;') && !html.includes('Slow <gateway>'));
});

test('buildTensionsHtml renders a friendly note when there are none', () => {
  assert.ok(buildTensionsHtml([]).includes('No tensions surfaced'));
});

test('buildExamplesHtml renders given/when/then, kind, and verdict buttons', () => {
  const html = buildExamplesHtml([
    { id: 'E1', kind: 'counter', given: 'g', when: 'w', then: 't <x>', claims: ['U1'] }
  ]);
  assert.ok(html.includes('data-id="E1"'));
  assert.ok(html.includes('ex-counter') && html.includes('must NOT happen'));
  assert.ok(html.includes('>Given<') && html.includes('>When<') && html.includes('>Then<'));
  assert.strictEqual(html.split('class="verdict-btn').length - 1, 2, 'examples use two verdicts');
  assert.ok(html.includes('data-example="Given g; When w; Then t &lt;x&gt;"'));
  assert.ok(html.includes('Pins claims: U1'));
});

test('buildOpenQuestionsHtml renders one escaped row with a textarea and data-id per entry', () => {
  const rows = buildOpenQuestionsHtml([
    { id: 'OQ1', question: 'Allow <script>?', whyItMatters: 'Security', proposedDefault: 'No', status: 'Open' },
    { id: 'OQ2', question: 'Cache TTL?', whyItMatters: 'UX', proposedDefault: '15m', status: 'Open' }
  ]);
  assert.strictEqual(rows.split('<tr ').length - 1, 2);
  assert.strictEqual(rows.split('<textarea').length - 1, 2);
  assert.ok(rows.includes('data-id="OQ1"'));
  assert.ok(rows.includes('&lt;script&gt;') && !rows.includes('<script>'));
});

test('injectContent fills all surfaces and leaves no unreplaced placeholders', () => {
  const html = injectContent(loadTemplate(TEMPLATE_PATH), sampleConfig());
  assert.ok(html.includes('Shared Understanding — Sample Feature'));
  assert.ok(html.includes('status-banner draft'));
  assert.ok(html.includes('Section one'));
  assert.ok(html.includes('id="recall-box"'));
  assert.ok(html.includes('id="add-claim-btn"'));
  const leftover = html.match(/{{[A-Z0-9_]+}}/g);
  assert.strictEqual(leftover, null, `unreplaced placeholders: ${leftover}`);
});

test('injectContent wires overview, checklist, tensions, examples, and the export button', () => {
  const html = injectContent(loadTemplate(TEMPLATE_PATH), sampleConfig());
  assert.ok(html.includes('<p>Condensed summary of what the user wants.</p>'));
  assert.ok(html.includes('The doc must prove the AI understands before coding.'));
  assert.ok(html.includes('data-fork="true"'));
  assert.ok(html.includes('Instant refunds'));
  assert.ok(html.includes('the retry is cancelled'));
  assert.ok(html.includes('id="copy-review-btn"'));
  assert.ok(html.includes('class="oq-answer"'));
});

test('injectContent escapes metadata but injects section HTML raw', () => {
  const html = injectContent(loadTemplate(TEMPLATE_PATH), sampleConfig({ title: 'A <b>bold</b> title' }));
  assert.ok(html.includes('A &lt;b&gt;bold&lt;/b&gt; title'));
  assert.ok(html.includes('<div class="mermaid">flowchart LR'));
});

test('injectContent tolerates missing structured arrays', () => {
  const config = sampleConfig();
  delete config.understanding;
  delete config.tensions;
  delete config.examples;
  delete config.openQuestions;
  delete config.revisionLog;
  const html = injectContent(loadTemplate(TEMPLATE_PATH), config);
  const leftover = html.match(/{{[A-Z0-9_]+}}/g);
  assert.strictEqual(leftover, null, `unreplaced placeholders: ${leftover}`);
  assert.ok(html.includes('No tensions surfaced'));
});

test('injectContent keeps dollar-sign patterns in section content literal', () => {
  const config = sampleConfig();
  config.sections['3'] = '<pre>price = `$&` + $1 + "$\'"</pre>';
  const html = injectContent(loadTemplate(TEMPLATE_PATH), config);
  assert.ok(html.includes('price = `$&` + $1 + "$\'"'));
});
