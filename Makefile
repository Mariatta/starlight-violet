# Build and serve Violet's documentation site against this checkout of Violet.
export ASTRO_TELEMETRY_DISABLED = 1

.PHONY: docs-install docs-build docs-dev docs-ci

# The site installs Violet as a copy (docs/.npmrc install-links), as npm would; reinstall after editing Violet.
docs-install:
	cd docs && rm -rf node_modules/starlight-violet && npm install --silent

docs-build: docs-install
	cd docs && npx astro build

# http://localhost:8009/starlight-violet/
docs-dev: docs-install
	cd docs && npx astro dev --port 8009

# CI and the Pages deploy: install exactly what the lockfile says, build, and
# type-check the plugin as a site using it would.
docs-ci:
	cd docs && npm ci && npx astro build && npx tsc --noEmit -p .
