#!/usr/bin/env bun
/**
 * Fail closed if product workflows schedule Darwin on GitHub-hosted macos-*.
 * PROJECT.md: product Darwin uses [self-hosted, sylphx, macos, standard] only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const WORKFLOWS = join(ROOT, '.github', 'workflows')

/** Matches GitHub-hosted macOS runner labels used as runs-on values. */
const FORBIDDEN = [
	/\bmacos-latest\b/i,
	/\bmacos-1[3-9]\b/i,
	/\bmacos-1[0-9]\b/i,
	/\bmacos-\d+\b/i,
]

const ALLOW_COMMENT_ONLY = true

function listYml(dir: string): string[] {
	const out: string[] = []
	for (const name of readdirSync(dir)) {
		const p = join(dir, name)
		if (statSync(p).isDirectory()) continue
		if (name.endsWith('.yml') || name.endsWith('.yaml')) out.push(p)
	}
	return out.sort()
}

function stripComments(line: string): string {
	// YAML full-line or trailing comments (good enough for runner labels).
	const idx = line.indexOf('#')
	if (idx === -1) return line
	// Keep # inside quotes roughly: if odd number of quotes before #, ignore
	const before = line.slice(0, idx)
	const quotes = (before.match(/"/g) || []).length + (before.match(/'/g) || []).length
	if (quotes % 2 === 1) return line
	return before
}

const violations: { file: string; line: number; text: string }[] = []

for (const file of listYml(WORKFLOWS)) {
	const body = readFileSync(file, 'utf8')
	const lines = body.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i]!
		const code = ALLOW_COMMENT_ONLY ? stripComments(raw) : raw
		// Skip pure comment / empty after strip
		if (!code.trim()) continue
		// Historical evidence docs are not workflows; only workflow files scanned.
		for (const re of FORBIDDEN) {
			if (re.test(code)) {
				// Allow strings that only appear inside policy forbidding text? still bad if runner label.
				// Explicit allow: none for product workflows.
				violations.push({ file, line: i + 1, text: raw.trim() })
				break
			}
		}
	}
}

if (violations.length > 0) {
	console.error('FORBIDDEN: GitHub-hosted macos-* runners in product workflows:')
	for (const v of violations) {
		const rel = v.file.replace(ROOT + '/', '')
		console.error(`  ${rel}:${v.line}: ${v.text}`)
	}
	console.error(
		'Policy: Darwin must use [self-hosted, sylphx, macos, standard] only (PROJECT.md / host-runtime-proof-contract).',
	)
	process.exit(1)
}

console.log('OK: no GitHub-hosted macos-* runners in .github/workflows')
