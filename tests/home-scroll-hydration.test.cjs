const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function loadLayout() {
  const exports = {};
  const code = ts.transpileModule(readFileSync('app/layout.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    exports,
    URL,
    require: (name) => {
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'next/font/google') return { Google_Sans_Code: () => ({ variable: 'code' }) };
      if (name === 'geist/font/sans') return { GeistSans: { variable: 'sans' } };
      if (name === '@/lib/utils') return { cn: (...names) => names.join(' ') };
      return {};
    },
  });
  return exports.default({ children: null }).props.children;
}

function restoreHeight(pathname, value) {
  const body = loadLayout();
  const script = body.props.children.find((child) => child?.type === 'script');
  const properties = new Map();
  runInNewContext(script.props.dangerouslySetInnerHTML.__html, {
    location: { pathname },
    sessionStorage: { getItem: () => value },
    document: {
      body: { style: new Proxy({}, { set() { throw new Error('Bootstrap mutated body before hydration'); } }) },
      documentElement: { style: { setProperty: (key, value) => properties.set(key, value) } },
    },
  });
  return { body, properties };
}

test('restores the scroll floor without changing React-owned body attributes', () => {
  const { body, properties } = restoreHeight('/', '1254');
  assert.equal(body.props.style.minHeight, 'max(100vh, var(--tb-home-min-height, 0px))');
  assert.equal(properties.get('--tb-home-min-height'), '1254px');
  assert.equal(body.props.suppressHydrationWarning, undefined);
});

test('does not restore a homepage scroll floor on other routes or without a saved height', () => {
  assert.equal(restoreHeight('/news/terminal-bench-4-1', '1254').properties.size, 0);
  assert.equal(restoreHeight('/', null).properties.size, 0);
});
