const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
}
const leaderboard = {};
runInNewContext(compile(readFileSync('lib/leaderboard.ts', 'utf8')), { exports: leaderboard });

// Execute the actual JSX navigation callbacks without starting React or fetching jobs.
function callback(file, attribute, context) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === attribute && ts.isJsxExpression(node.initializer)) {
      const candidate = node.initializer.expression;
      if (candidate?.getText(tree).includes('harborLeaderboardRowUrl')) expression = candidate.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression, `${file} has a leaderboard-row navigation callback`);
  const exports = {};
  runInNewContext(compile(`export const navigate = ${expression};`), {
    exports, harborLeaderboardRowUrl: leaderboard.harborLeaderboardRowUrl, ...context,
  });
  return exports.navigate;
}

for (const version of ['4.1', '4.0']) {
  test(`Pareto and table clicks open the TB ${version} submission row rather than a job`, () => {
    const benchmark = leaderboard.homeBenchmarkById(version);
    const id = '24f711aa-b0cc-4f09-8627-b5f70a27b73b';
    const expected = `https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/${version === '4.1' ? 'latest' : '4'}/leaderboards/${benchmark.leaderboard}/rows/${id}`;
    const table = callback('components/leaderboard/leaderboard-table.tsx', 'getRowHref', { benchmark });
    assert.equal(table({ id }), expected);
    const opened = [];
    const pareto = callback('components/charts/pareto-scatter-chart.tsx', 'onClick', {
      benchmark, datum: { id }, window: { open: (...args) => opened.push(args) },
    });
    pareto();
    assert.equal(opened.length, 1);
    assert.equal(opened[0][0], expected);
    assert.equal(opened[0][1], '_blank');
  });
}
