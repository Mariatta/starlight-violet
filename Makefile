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
# The test site uses docs' packages, linked in.
test: docs-install
	$(MAKE) test-run

# CI: docs-ci has installed the packages already.
test-ci: test-run

# Tests the copy of Violet in docs/node_modules, which make test reinstalls first;
# on its own, after editing Violet, it tests the copy from the last install.
test-run:
	rm -rf test/site/node_modules
	ln -s ../../docs/node_modules test/site/node_modules
	cd test/site && npx astro build
	cd docs && npx tsc --noEmit -p ../test/site
	node --test 'test/*.test.mjs'
