#!/usr/bin/env node

/**
 * AI Code Review — runs on pre-push via husky.
 *
 * Delegates to Claude Agent SDK (code-reviewer pattern from OMC).
 * Gets the diff of commits being pushed, sends to AI for review.
 * Blocks push if CRITICAL or HIGH severity issues are found.
 *
 * Anti-reinvention: uses @anthropic-ai/claude-agent-sdk query(),
 * not raw Anthropic API.
 *
 * Skip with: SKIP_AI_REVIEW=1 git push
 */

import { execSync } from 'node:child_process';

// Allow skipping in CI or when explicitly requested
if (process.env.SKIP_AI_REVIEW === '1' || process.env.CI) {
  console.log('⊡ AI review skipped (SKIP_AI_REVIEW=1 or CI)');
  process.exit(0);
}

// Get the diff of what's being pushed
function getDiff() {
  try {
    // Diff between remote tracking branch and HEAD
    const upstream = execSync('git rev-parse --abbrev-ref @{upstream} 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    return execSync(`git diff ${upstream}..HEAD`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    // No upstream — diff last commit
    try {
      return execSync('git diff HEAD~1..HEAD', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    } catch {
      return '';
    }
  }
}

function getChangedFiles() {
  try {
    const upstream = execSync('git rev-parse --abbrev-ref @{upstream} 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    return execSync(`git diff --name-only ${upstream}..HEAD`, { encoding: 'utf-8' }).trim();
  } catch {
    try {
      return execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return '';
    }
  }
}

async function main() {
  const diff = getDiff();
  const changedFiles = getChangedFiles();

  if (!diff || diff.length < 10) {
    console.log('⊡ No meaningful changes to review');
    process.exit(0);
  }

  // Truncate large diffs to avoid token limits
  const maxDiffLen = 50000;
  const truncatedDiff = diff.length > maxDiffLen ? diff.slice(0, maxDiffLen) + '\n\n[... diff truncated]' : diff;

  console.log('🔍 AI code review in progress...');
  console.log(`   Files: ${changedFiles.split('\n').length} changed`);

  let query;
  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    query = sdk.query;
  } catch {
    console.log('⚠ Claude Agent SDK not available — skipping AI review');
    process.exit(0);
  }

  const prompt = `Review this code diff. You are a code reviewer focused on finding real issues, not style nitpicks.

Changed files:
${changedFiles}

Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`

Review checklist:
1. Security: injection, hardcoded secrets, unsafe input handling
2. Logic: off-by-one, null/undefined, unreachable code, missing error handling
3. Correctness: does the change do what it claims?
4. Breaking changes: could this break existing functionality?

For each issue found, report:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- File and line reference
- What's wrong and how to fix it

If no issues found, say "LGTM — no issues found."

End with a verdict line:
VERDICT: APPROVE | REQUEST_CHANGES | COMMENT`;

  let result = '';

  try {
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 3,
        allowedTools: [],
        permissionMode: 'plan',
        systemPrompt:
          'You are a senior code reviewer. Be concise. Focus on real bugs and security issues, not style. Output your review in plain text, not markdown.',
      },
    })) {
      if ('result' in message) {
        result = message.result;
      }
    }
  } catch (err) {
    console.log(`⚠ AI review failed: ${err instanceof Error ? err.message : err}`);
    console.log('   Continuing with push (non-blocking)');
    process.exit(0);
  }

  // Parse verdict
  const hasBlocker =
    result.includes('VERDICT: REQUEST_CHANGES') ||
    (result.includes('CRITICAL') && !result.includes('CRITICAL: 0'));

  console.log('\n' + result);
  console.log('');

  if (hasBlocker) {
    console.log('✗ AI review found blocking issues. Fix before pushing.');
    console.log('  To skip: SKIP_AI_REVIEW=1 git push');
    process.exit(1);
  } else {
    console.log('✓ AI review passed');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('⚠ AI review error:', err.message);
  process.exit(0); // Non-blocking on unexpected errors
});
