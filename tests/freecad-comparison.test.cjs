const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const cad = {};
runInNewContext(ts.transpileModule(readFileSync('lib/freecad-comparison.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: cad, Blob, Response, DecompressionStream, atob, Uint8Array, Int16Array });

test('intro is blank and ending contains both completed models', () => {
  assert.equal(cad.cadPositions(-1).join(','), '-1,-1');
  assert.equal(cad.cadPositions(cad.CAD_DURATION).join(','), '15,30');
  assert.equal(cad.CAD_END, 11850);
});

test('each checkpoint begins with the corresponding feature on both sides', () => {
  const nativeFeatures = [0, 1, 3, 5, 9];
  cad.CAD_STARTS.forEach((time, index) => {
    const [left, right] = cad.cadPositions(time);
    assert.equal(left, index * 3);
    assert.equal(right, nativeFeatures[index] * 3);
  });
  assert.equal(cad.CAD_CHECKPOINTS.reduce((sum, cp) => sum + cp.duration, 0), cad.CAD_DURATION);
});

test('native cylinder addition, solid cylinder, and cylinder cutter each last one second', () => {
  for (let time = 1000; time < 2000; time += 10) assert.equal(Math.floor(cad.cadPositions(time)[1] / 3), 1);
  for (let time = 2000; time < 3000; time += 10) assert.equal(cad.cadPositions(time)[1], 5.5);
  for (let time = 3000; time < 4000; time += 10) assert.equal(Math.floor(cad.cadPositions(time)[1] / 3), 2);
});

test('each subsequent native primitive gets a full second', () => {
  for (let time = 4000; time < 11000; time += 10) {
    assert.equal(Math.floor(cad.cadPositions(time)[1] / 3), 3 + Math.floor((time - 4000) / 1000));
  }
});

test('cutting features draw a flat sketch before growing the cutting volume', () => {
  for (const index of [3, 4]) {
    const start = cad.CAD_STARTS[index], duration = cad.CAD_CHECKPOINTS[index].duration;
    assert(cad.cadPositions(start + duration * .39)[0] < index * 3 + 1);
    assert(cad.cadPositions(start + duration * .41)[0] > index * 3 + 1);
  }
});

test('saved trial meshes decode and all feature buffers are valid', async () => {
  const data = await cad.decodeCadMeshes(JSON.parse(readFileSync('public/blog/freecad-comparison/meshes.json', 'utf8')));
  assert.equal(data.lanes[0].length, 5);
  assert.equal(data.lanes[1].length, 10);
  for (const feature of data.lanes.flat()) {
    for (const mesh of [feature.final, feature.tool, feature.sketch, ...feature.frames]) {
      if (!mesh || mesh.tri < 0) continue;
      assert(data.arrays[mesh.tri]);
      assert(data.arrays[mesh.line]);
      assert.equal(data.arrays[mesh.tri].length % 9, 0);
      assert.equal(data.arrays[mesh.line].length % 6, 0);
    }
  }
});
