# Build and serve Violet's documentation site against this checkout of Violet.
export ASTRO_TELEMETRY_DISABLED = 1

.PHONY: docs-install docs-build docs-dev docs-ci test test-ci test-run

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

# Violet's tests: build the site in test/site from the notes in test/notes,
# with Violet from this checkout, then check the pages it wrote (test/*.test.mjs).
# The test site has its own packages, with Violet installed as a copy as in docs/,
# so a running make docs-dev is left alone; make test reinstalls Violet each time.
test:
	cd test/site && rm -rf node_modules/starlight-violet && npm install --silent
	$(MAKE) test-run

# CI: install exactly what the test site's lockfile says.
test-ci:
	cd test/site && npm ci
	$(MAKE) test-run

# What make test and make test-ci run once the packages are in.
test-run:
	@test -d test/site/node_modules/starlight-violet || { echo "test/site has no packages: run make test"; exit 1; }
	cd test/site && npx --no-install astro build
	cd test/site && npx --no-install tsc --noEmit -p .
	node --test 'test/*.test.mjs'
