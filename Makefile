# AI Geo-Timestamp - there is no build step, so these are just the chores
# worth naming. Run `make` on its own to see them and the current hook status.

HOOKS_DIR := hooks
PORT      ?= 8000

.DEFAULT_GOAL := help
.PHONY: help activate-hooks hooks-status verify-hooks serve check

help: ## Show available targets and whether the git hooks are active
	@echo "AI Geo-Timestamp"
	@echo
	@echo "Targets:"
	@grep -hE '^[a-z][a-z-]*:.*## ' $(MAKEFILE_LIST) \
		| awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'
	@echo
	@$(MAKE) --no-print-directory hooks-status

activate-hooks: ## Enable the tracked pre-commit hook (run once per clone)
	@git config core.hooksPath $(HOOKS_DIR)
	@chmod +x $(HOOKS_DIR)/pre-commit
	@echo "core.hooksPath = $$(git config core.hooksPath)"
	@echo "Commits will now bump CACHE_NAME in service-worker.js."

hooks-status: ## Report whether the pre-commit hook is active
	@if [ "$$(git config core.hooksPath)" = "$(HOOKS_DIR)" ]; then \
		echo "hooks: active (core.hooksPath=$(HOOKS_DIR))"; \
	else \
		echo "hooks: NOT ACTIVE - run 'make activate-hooks', or commits will"; \
		echo "       ship an unchanged CACHE_NAME and returning users keep stale assets"; \
	fi

verify-hooks: ## Same check, but fail the build if the hook is not active
	@if [ "$$(git config core.hooksPath)" != "$(HOOKS_DIR)" ]; then \
		echo "error: core.hooksPath is not '$(HOOKS_DIR)' - run 'make activate-hooks'" >&2; \
		exit 1; \
	fi
	@test -x $(HOOKS_DIR)/pre-commit \
		|| { echo "error: $(HOOKS_DIR)/pre-commit is not executable" >&2; exit 1; }
	@echo "hooks: ok"

serve: ## Serve on localhost:8000 - a secure context, unlike opening file://
	@echo "Serving on http://localhost:$(PORT) - Ctrl-C to stop"
	@python3 -m http.server $(PORT)

check: ## Syntax-check index.js, service-worker.js and the inline scripts
	@node --check index.js
	@node --check service-worker.js
	@node -e "const fs=require('fs'),vm=require('vm'); \
		const m=[...fs.readFileSync('index.html','utf8').matchAll(/<script>([\\s\\S]*?)<\\/script>/g)]; \
		m.forEach((x,i)=>new vm.Script(x[1],{filename:'inline-'+i})); \
		console.log('inline scripts parse OK ('+m.length+')')"
	@echo "check: ok"
