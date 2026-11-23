import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = [
  ['Node.js', process.execPath, ['--version']],
  ['Rust compiler', 'rustc', ['--version']],
  ['Cargo', 'cargo', ['--version']],
];
let missing = false;
for (const [label, executable, args] of required) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true });
  const ok = result.status === 0;
  console.log(`${ok ? 'OK' : 'MISSING'} ${label}${ok ? `: ${result.stdout.trim()}` : ''}`);
  missing ||= !ok;
}
for (const [label, path] of [
  ['Frontend dependencies', 'node_modules/typescript/bin/tsc'],
  ['npm lockfile', 'package-lock.json'],
  ['Cargo lockfile', 'src-tauri/Cargo.lock'],
]) {
  const ok = existsSync(resolve(path));
  console.log(`${ok ? 'OK' : 'MISSING'} ${label}`);
  missing ||= !ok;
}
console.log('Native build also requires Windows C++ Build Tools and WebView2; verify using Tauri prerequisites.');
process.exitCode = missing ? 1 : 0;
