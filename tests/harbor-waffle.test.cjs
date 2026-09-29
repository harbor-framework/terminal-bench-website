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

function fixture({ missing = false, upstreamError = false, incomplete = false } = {}) {
  const count = 1005;
  const links = Array.from({ length: count }, (_, i) => ({ row_id: 'row', trial_id: `trial-${i}` }));
  const requests = [];
  let active = 0;
  let peak = 0;
  const exports = {};
  runInNewContext(source, {
    exports, process: { env: {} }, URLSearchParams, AbortSignal,
    require: () => ({}),
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
        assert.equal(init.cache, 'no-store');
        if (upstreamError) return Response.json({ message: 'upstream failed' }, { status: 500 });
        const ids = parsed.searchParams.get('id').slice(4, -1).split(',');
        assert(ids.length <= 100);
        const items = ids.map((id) => {
          const i = Number(id.split('-')[1]);
          return { id, job_id: `job-${i % 2}`, task_name: 'task',
            rewards: i % 4 === 0 ? { z: 0, a: 1 } : { z: 1, a: 0 },
            exception_type: i % 4 === 1 ? 'AgentTimeoutError' : i % 4 === 2 ? 'Error' : null,
            hosted_error: null };
        });
        if (missing) items.pop();
        return Response.json(items);
      } finally { active--; }
    },
  });
  return { load: () => exports.readTerminalBenchWaffle('org/package', 'main'), requests, peak: () => peak };
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
