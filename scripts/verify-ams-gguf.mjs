#!/usr/bin/env node
/**
 * Verify / optionally place AMS Micro (and sibling) weights.
 *
 * Usage:
 *   node scripts/verify-ams-gguf.mjs
 *   node scripts/verify-ams-gguf.mjs --place path\to\file.gguf --as ams-micro-70m
 *   node scripts/verify-ams-gguf.mjs --place path\to\file.onnx --as ams-micro-70m
 *
 * Reports real .gguf or .onnx matches under models/ams (or custom GGUF).
 * Never invents installs; never claims GGUF when the match is ONNX.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const amsDir = path.join(repoRoot, "models", "ams");
const customDir = path.join(repoRoot, "models", "custom");
const catalogPath = path.join(amsDir, "catalog.json");

function listByExt(dir, ext) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(ext))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function basenameLower(full) {
  return path.basename(full).toLowerCase();
}

function parseArgs(argv) {
  const out = { place: null, as: null, fileName: null, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--place") out.place = argv[++i] ?? null;
    else if (a === "--as") out.as = argv[++i] ?? null;
    else if (a === "--name") out.fileName = argv[++i] ?? null;
    else if (a === "--all") out.all = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function loadCatalog(includeAdvanced) {
  const raw = fs.readFileSync(catalogPath, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const showAdv =
    includeAdvanced ||
    ["1", "true", "yes"].includes(String(process.env.ASI_AMS_SHOW_ADVANCED ?? "").trim().toLowerCase());
  return {
    label: parsed.label ?? "AMS",
    items: showAdv ? items : items.filter((i) => i.advanced !== true),
  };
}

function hintsFor(item, { onnx = false } = {}) {
  const base = [item.id, ...(item.weightHints ?? [])].map((h) => String(h).toLowerCase()).filter(Boolean);
  if (!onnx) return base;
  const extra = (item.onnxWeightHints ?? []).map((h) => String(h).toLowerCase()).filter(Boolean);
  return Array.from(new Set([...base, ...extra]));
}

function findMatch(item, amsGgufs, customGgufs, amsOnnxs) {
  const ggufHints = hintsFor(item, { onnx: false });
  for (const full of amsGgufs) {
    if (ggufHints.some((h) => basenameLower(full).includes(h))) {
      return { file: path.basename(full), dir: "ams", format: "gguf" };
    }
  }
  for (const full of customGgufs) {
    if (ggufHints.some((h) => basenameLower(full).includes(h))) {
      return { file: path.basename(full), dir: "custom", format: "gguf" };
    }
  }
  const onnxHints = hintsFor(item, { onnx: true });
  for (const full of amsOnnxs) {
    if (onnxHints.some((h) => basenameLower(full).includes(h))) {
      return { file: path.basename(full), dir: "ams", format: "onnx" };
    }
  }
  return null;
}

function place(source, recipeId, fileName, items) {
  const src = path.resolve(source);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
    throw new Error(`Source not found: ${src}`);
  }
  const lower = src.toLowerCase();
  const isGguf = lower.endsWith(".gguf");
  const isOnnx = lower.endsWith(".onnx");
  if (!isGguf && !isOnnx) {
    throw new Error("Source must be a .gguf or .onnx file");
  }
  const recipe = recipeId ? items.find((i) => i.id === recipeId) : null;
  if (recipeId && !recipe) {
    throw new Error(`Unknown recipe id: ${recipeId}`);
  }
  const fallback = isOnnx
    ? recipe?.suggestedOnnxFileName || path.basename(src)
    : recipe?.suggestedFileName || path.basename(src);
  const destName = (fileName || fallback).replace(/[/\\]/g, "");
  if (isGguf && !destName.toLowerCase().endsWith(".gguf")) {
    throw new Error("Destination name must end with .gguf");
  }
  if (isOnnx && !destName.toLowerCase().endsWith(".onnx")) {
    throw new Error("Destination name must end with .onnx");
  }
  fs.mkdirSync(amsDir, { recursive: true });
  const dest = path.join(amsDir, destName);
  fs.copyFileSync(src, dest);
  return dest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Verify AMS install status (recipe vs installed for GGUF/ONNX).

  node scripts/verify-ams-gguf.mjs
  node scripts/verify-ams-gguf.mjs --all
  node scripts/verify-ams-gguf.mjs --place path\\to\\weights.gguf --as ams-micro-70m
  node scripts/verify-ams-gguf.mjs --place path\\to\\weights.onnx --as ams-micro-70m

Ship default lists Micro 70M + Hybrid 120M only. Use --all or ASI_AMS_SHOW_ADVANCED=1 for Agent Chat / Ultra gate.
`);
    process.exit(0);
  }

  if (!fs.existsSync(catalogPath)) {
    console.error(`Missing catalog: ${catalogPath}`);
    process.exit(1);
  }

  const { label, items } = loadCatalog(args.all);

  if (args.place) {
    try {
      const dest = place(args.place, args.as, args.fileName, items);
      console.log(`Placed → ${dest}`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  const amsGgufs = listByExt(amsDir, ".gguf");
  const customGgufs = listByExt(customDir, ".gguf");
  const amsOnnxs = listByExt(amsDir, ".onnx");

  console.log(label);
  console.log(`AMS dir: ${amsDir}`);
  console.log(`GGUF files in models/ams: ${amsGgufs.length}`);
  console.log(`ONNX files in models/ams: ${amsOnnxs.length}`);
  console.log("");

  let recipeCount = 0;
  let installedCount = 0;

  for (const item of items) {
    const match = findMatch(item, amsGgufs, customGgufs, amsOnnxs);
    const status = match ? "installed" : "recipe";
    if (match) installedCount++;
    else recipeCount++;
    const size = [item.diskSizeHint, item.ramHint, item.hardwareHint].filter(Boolean).join(" · ");
    console.log(`[${status.padEnd(9)}] ${item.id}`);
    console.log(`  ${item.name}${item.params ? ` (${item.params})` : ""}`);
    if (size) console.log(`  ${size}`);
    if (match) {
      const fmt = match.format === "onnx" ? "ONNX on disk" : "GGUF";
      console.log(`  matched: ${match.dir}/${match.file} · ${fmt}`);
    } else {
      const suggest = [
        item.suggestedFileName ? `${item.pathHint ?? "models/ams/"}${item.suggestedFileName}` : null,
        item.suggestedOnnxFileName ? `${item.pathHint ?? "models/ams/"}${item.suggestedOnnxFileName}` : null,
      ]
        .filter(Boolean)
        .join(" or ");
      if (suggest) console.log(`  suggest:  ${suggest}`);
    }
    console.log("");
  }

  console.log(
    `Summary: ${installedCount} installed · ${recipeCount} recipe(s) still missing · ${amsGgufs.length} .gguf · ${amsOnnxs.length} .onnx in models/ams`
  );
  if (installedCount === 0) {
    console.log("No AMS weights on disk yet — catalog rows are recipes only (not fake installs).");
    console.log("Install: npm run install:ams (fetches GGUF or ONNX from HF), or place files under models/ams/.");
  }
  process.exit(0);
}

main();
