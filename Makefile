.PHONY: help gnome-install gnome-pack gnome-release test lint-py check-pricing
.DEFAULT_GOAL := help

help: ## list targets
	@awk 'BEGIN{FS=":.*##"} /^[a-z][a-zA-Z0-9_-]+:.*##/ {printf "  make %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

gnome-install: ## install the GNOME Shell extension locally
	@$(MAKE) -C gnome-extension install

gnome-pack: ## build the GNOME Shell extension .zip archives
	@$(MAKE) -C gnome-extension pack

gnome-release: ## bump version, tag, and push — triggers the GitHub release workflow
	@$(MAKE) -C gnome-extension release

test: ## run the provider backend contract tests
	@./tests/get-ai-usage.test.sh
	@./tests/ai-usage-cli.test.sh
	@./tests/python-interp.test.sh
	@./tests/get-codex-stats.test.sh
	@./tests/get-codex-rate-limits.test.sh
	@if command -v node >/dev/null 2>&1; then node --test tests/*.test.js; \
	  else echo "skipping tests/shared-code.test.js (node not found)"; fi

lint-py: ## lint + format-check the Python backend (dev only, needs ruff)
	@if command -v ruff >/dev/null 2>&1; then \
	  ruff check package/contents/tools/aiusage && \
	  ruff format --check package/contents/tools/aiusage; \
	else \
	  echo "ruff not found — install it or run 'nix develop'"; exit 1; \
	fi

check-pricing: ## report drift between billing.py and the live pricing pages (dev only)
	@./scripts/check-pricing.py
