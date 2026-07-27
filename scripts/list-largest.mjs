#!/usr/bin/env node
/**
 * List the top 20 largest files and folders in the project.
 * Run with: npm run analyze:size
 */
import { readdirSync, statSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".output",
  ".vinxi",
  "coverage",
  "playwright-report",
  "test-results",
  ".lovable",
]);

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log10(bytes) / 3)
  );
  const value = bytes / Math.pow(1000, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function walk(dir, results) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let dirSize = 0;

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(ROOT, fullPath);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const size = walk(fullPath, results);
      results.dirs.push({ path: relPath || ".", size });
      dirSize += size;
    } else if (entry.isFile()) {
      const size = statSync(fullPath).size;
      results.files.push({ path: relPath, size });
      dirSize += size;
    }
  }

  return dirSize;
}

function printTable(title, items) {
  console.log(`\n${title}`);
  console.log("-".repeat(80));
  console.log(`${"Rank".padEnd(6)} ${"Size".padEnd(12)} Path`);
  console.log("-".repeat(80));
  items.forEach((item, index) => {
    console.log(
      `${String(index + 1).padEnd(6)} ${formatBytes(item.size).padEnd(12)} ${item.path}`
    );
  });
}

function main() {
  const results = { files: [], dirs: [] };
  const totalSize = walk(ROOT, results);

  const topFiles = results.files
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  const topDirs = results.dirs
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  console.log(`Project root: ${ROOT}`);
  console.log(`Total scanned size: ${formatBytes(totalSize)}`);

  printTable("Top 20 largest files", topFiles);
  printTable("Top 20 largest folders", topDirs);
}

main();
