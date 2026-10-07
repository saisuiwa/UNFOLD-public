// Starts headless Chromium with software WebGL (SwiftShader), so the checks and the preview maker also run on a machine without a GPU.
// Playwright is found as a normal package, or among the globally installed ones (that is where the cloud sessions have it).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function loadPlaywright() {
  const attempts = [() => createRequire(import.meta.url)('playwright'), () => createRequire(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/`)('playwright')];
  for (const attempt of attempts) { try { return attempt(); } catch { /* try the next place */ } }
  throw new Error('Playwright was not found (npm i -g playwright, or set it up like the cloud sessions do).');
}

export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  const executablePath = process.env.UNFOLD_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  // TMPDIR is pinned to /tmp for the browser only: Chromium puts a socket in its profile folder, and a long TMPDIR path makes it crash at start.
  return chromium.launch({ ...(executablePath ? { executablePath } : {}), env: { ...process.env, TMPDIR: '/tmp' }, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
}
