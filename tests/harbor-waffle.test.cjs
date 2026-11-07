const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

// Exercise the actual server loader without booting Next or contacting Harbor.
const source = ts.transpileModule(
  readFileSync('lib/harbor-waffle.server.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture({ missing = false, upstreamError = false, incomplete = false, regrade = false, incompleteRegrades = false, duplicateRegrade = false } = {}) {
  const count = 1005;
  const links = Array.from({ length: count }, (_, i) => ({ row_id: 'row', trial_id: `${regrade && i === 999 ? 'regrade' : 'trial'}-${i}` }));
  const requests = [];
  let active = 0;
  let peak = 0;
  const exports = {};
  runInNewContext(source, {
    exports, process: { env: {} }, URLSearchParams, AbortSignal,
    require: () => ({ TERMINAL_BENCH_PACKAGE: 'terminal-bench/terminal-bench' }),
    fetch: async (url, init) => {
      active++;
      peak = Math.max(peak, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const parsed = new URL(url);
        requests.push(parsed);
        if (parsed.pathname.includes('leaderboard-read')) {
          return Response.json({ leaderboard: { id: 'board', name: 'main', title: 'Test' }, rows: [{ id: 'row', n_trials: count }] });
        }
        if (parsed.pathname.includes('leaderboard_row_trial')) {
          assert.equal(parsed.searchParams.get('order'), 'row_id.asc,trial_id.asc');
          const offset = Number(parsed.searchParams.get('offset'));
          const items = links.slice(offset, offset + 1000);
          if (incomplete && offset) items.pop();
          return Response.json(items, { headers: { 'content-range': `0-999/${count}` } });
        }
        assert.equal(parsed.pathname, '/rest/v1/trial');
        if (parsed.searchParams.has('job_id')) {
          assert.equal(parsed.searchParams.get('job_id'), 'eq.6179005b-d9e6-5304-8eb3-5564518ac97b');
          assert.equal(parsed.searchParams.get('select'), 'id,source_trial_id:config->source_trial->>trial_id');
          assert.equal(parsed.searchParams.get('order'), 'created_at.asc,id.asc');
          // The last four originals have no regrade. Regrade rewards need not match reviewed outcomes.
          const offset = Number(parsed.searchParams.get('offset'));
          const regrades = Array.from({ length: 1001 }, (_, i) => ({
            id: `regrade-${i}`, source_trial_id: `trial-${duplicateRegrade && i === 1 ? 0 : i}`,
          })).slice(offset, offset + 1000);
          if (incompleteRegrades && offset) regrades.pop();
          return Response.json(regrades, { headers: { 'content-range': '0-999/1001' } });
        }
        assert.equal(init.cache, 'no-store');
        if (upstreamError) return Response.json({ message: 'upstream failed' }, { status: 500 });
        const ids = parsed.searchParams.get('id').slice(4, -1).split(',');
        assert(ids.length <= 100);
        const items = ids.map((id) => {
          const i = Number(id.split('-')[1]);
          return { id, job_id: id.startsWith('regrade-') ? '6179005b-d9e6-5304-8eb3-5564518ac97b' : `job-${i % 2}`, task_name: 'task',
            rewards: i % 4 === 0 ? { z: 0, a: 1 } : { z: 1, a: 0 },
            exception_type: i % 4 === 1 ? 'AgentTimeoutError' : i % 4 === 2 ? 'Error' : null,
            hosted_error: null };
        });
        if (missing) items.pop();
        return Response.json(items);
      } finally { active--; }
    },
  });
  return { load: () => exports.readTerminalBenchWaffle(regrade ? 'terminal-bench/terminal-bench' : 'org/package', regrade ? '4-1-0' : 'main'), requests, peak: () => peak };
}

test('returns every linked trial, bounds concurrency, and preserves outcomes and job links', async () => {
  const f = fixture();
  const data = await f.load();
  assert.equal(data.trial_count, 1005);
  assert.equal(data.row_count, 1);
  assert.equal(data.task_count, 1);
  assert.equal(f.peak(), 4);
  const task = data.doms[0].tasks[0];
  assert.deepEqual([task.p, task.e_to, task.e_err, task.f], [252, 251, 251, 251]);
  for (const trial of task.ts) assert.equal(trial.j, `job-${Number(trial.id.split('-')[1]) % 2}`);
  assert.equal(new Set(task.ts.map((trial) => trial.id)).size, 1005);
});

test('rejects missing trials rather than returning a partial chart', async () => {
  await assert.rejects(fixture({ missing: true }).load(), /Linked trials are missing/);
});

test('rejects incomplete link pagination', async () => {
  await assert.rejects(fixture({ incomplete: true }).load(), /links are incomplete/);
});

test('propagates upstream failures', async () => {
  await assert.rejects(fixture({ upstreamError: true }).load(), /upstream failed/);
});


test('TB 4.1 links every available regrade, retains missing originals, and preserves reviewed counts', async () => {
  const data = await fixture({ regrade: true }).load();
  const task = data.doms[0].tasks[0];
  assert.deepEqual([task.p, task.e_to, task.e_err, task.f], [252, 251, 251, 251]);
  assert.equal(data.trial_count, 1005);
  assert.deepEqual([...data.jobs].sort(), ['6179005b-d9e6-5304-8eb3-5564518ac97b', 'job-0', 'job-1']);
  assert.equal(new Set(task.ts.map(trial => trial.id)).size, 1005);
  for (const trial of task.ts) {
    const i = Number(trial.id.split('-')[1]);
    assert.equal(trial.id, `${i < 1001 ? 'regrade' : 'trial'}-${i}`);
    assert.equal(trial.j, i < 1001 ? '6179005b-d9e6-5304-8eb3-5564518ac97b' : `job-${i % 2}`);
  }
});

test('rejects incomplete regrade pagination instead of silently linking originals', async () => {
  await assert.rejects(fixture({ regrade: true, incompleteRegrades: true }).load(), /Regrade trial links are incomplete/);
});

test('rejects ambiguous source-to-regrade matches', async () => {
  await assert.rejects(fixture({ regrade: true, duplicateRegrade: true }).load(), /ambiguous/);
});
