import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Vue templates/CSS often mention storage APIs in prose (e.g. a privacy-policy paragraph); only
 * `<script>`/`<script setup>` content can actually call them, so only that is scanned for `.vue`. */
export function storageScanContent(path, content) {
  if (!path.endsWith('.vue')) return content;

  return [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join('\n');
}

export function scan(root, dir, pattern, matches = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry);
    const full = join(root, path);
    const stat = statSync(full);
    if (stat.isDirectory()) scan(root, path, pattern, matches);
    else if (pattern.test(readFileSync(full, 'utf8'))) matches.push(path);
  }
  return matches;
}

export function scanStorage(root, dir, pattern, matches = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry);
    const full = join(root, path);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      scanStorage(root, path, pattern, matches);
      continue;
    }

    const content = readFileSync(full, 'utf8');
    if (pattern.test(storageScanContent(path.replaceAll('\\', '/'), content))) {
      matches.push(path);
    }
  }

  return matches;
}
