# ROBOCO CLI — Developer Workflow
# TypeScript · Node.js ≥ 24 · npm

.PHONY: all check format check-format lint fix test test-unit test-integration test-e2e test-all typecheck build clean coverage

# ─── Full local workflow ───────────────────────────────────────────────
# Mutating targets run sequentially (format → fix), then parallel-safe targets.
all: format fix test build

# ─── CI-friendly checks (no mutation) ──────────────────────────────────
check: check-format lint typecheck test build

# ─── Format / Lint ─────────────────────────────────────────────────────
format:
	@npm run format

check-format:
	@npm run format:check

lint:
	@npm run lint

fix: format
	@npm run lint:fix

# ─── Type checking ─────────────────────────────────────────────────────
typecheck:
	@npm run typecheck

# ─── Tests ─────────────────────────────────────────────────────────────
test:
	@npm run test

test-unit:
	@npm run test:unit

test-integration:
	@npm run test:integration

test-e2e:
	@npm run test:e2e

test-all:
	@npm run test:all

# ─── Build ─────────────────────────────────────────────────────────────
build:
	@npm run build

# ─── Utilities ─────────────────────────────────────────────────────────
clean:
	@rm -rf dist coverage

coverage:
	@npx vitest run --coverage
