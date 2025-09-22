#!/usr/bin/env node

import prompts from 'prompts';
import { stat, readFile, readdir } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import process from 'node:process';

const SUBMIT_URL = 'https://sot-2025.stqry.dev/submit';
const ui = {
  title: '\x1b[1m\x1b[36m',
  bold: '\x1b[1m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

function resolveCandidateToken(rawToken) {
  if (!rawToken || !rawToken.trim()) {
    console.error(`\n${ui.error}${ui.bold}Error${ui.reset}: Provide your candidateToken as the first argument.`);
    console.error(`\n${ui.bold}Usage${ui.reset}: npm run submit <candidateToken>`);
    process.exit(1);
  }
  return rawToken.trim();
}

async function promptAiUsage() {
  const { aiUsage } = await prompts({
    type: 'text',
    name: 'aiUsage',
    message: 'What AI models and tools have you used?',
    initial: 'None',
  });
  if (aiUsage === undefined) return null;
  return aiUsage.trim();
}

async function confirmSubmission() {
  const { shouldSubmit } = await prompts({
    type: 'confirm',
    name: 'shouldSubmit',
    message: 'Submit your solution now?',
    initial: true,
  });
  return shouldSubmit;
}

async function collectFiles() {
  const root = 'src';
  const rootPath = resolve(process.cwd(), root);
  try {
    const info = await stat(rootPath);
    if (!info.isDirectory()) {
      return [];
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files = [];
  const walk = async (relativePath) => {
    const fullPath = resolve(process.cwd(), relativePath);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      const children = await readdir(fullPath, { withFileTypes: true });
      children.sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        const childRelative = relativePath ? posix.join(relativePath, child.name) : child.name;
        await walk(childRelative);
      }
      return;
    }
    files.push({
      Path: relativePath,
      Contents: await readFile(fullPath, 'utf8'),
    });
  };
  await walk(root);
  return files;
}

async function uploadSubmission(payload) {
  const response = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = `status ${response.status}`;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.Message === 'string' && parsed.Message.trim()) {
          detail = parsed.Message.trim();
        }
      } catch (error) {
        const summary = text.split('\n', 1)[0].trim().slice(0, 60);
        if (summary) {
          detail = summary;
        }
      }
    }
    throw new Error(detail);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    data = null;
  }
  if (data && typeof data.Message === 'string' && data.Message.trim()) {
    return data.Message.trim();
  }
  return 'Submission uploaded successfully.';
}

async function main() {
  try {
    console.log(`${ui.title}STQRY Tech Test 2025${ui.reset}`);
    const CandidateToken = resolveCandidateToken(process.argv[2]);
    const Files = await collectFiles();
    if (Files.length === 0) {
      return console.log(`\n${ui.warn}No source files found in src/. Nothing to submit.${ui.reset}`);
    }
    console.log(`\n${ui.bold}Files to submit${ui.reset}`);
    Files.forEach(({ Path }) => {
      console.log(`  • ${Path}`);
    });
    console.log(`\n${ui.title}AI usage statement${ui.reset}\n`);
    const AIUsage = await promptAiUsage();
    if (AIUsage === null) {
      return console.log(`\n${ui.warn}Submission cancelled. Nothing was sent.${ui.reset}`);
    }
    console.log('');
    const shouldSubmit = await confirmSubmission();
    if (!shouldSubmit) {
      return console.log(`\n${ui.warn}Submission cancelled. Nothing was sent.${ui.reset}`);
    }
    const message = await uploadSubmission({ CandidateToken, Files, AIUsage });
    console.log(`\n${ui.success}${message}${ui.reset}`);
  } catch (error) {
    console.error(`\n${ui.error}${ui.bold}Error${ui.reset}: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
