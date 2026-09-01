.PHONY: install pack release schemas

schemas:
	glib-compile-schemas schemas

install: ## install the extension into the local GNOME session
	./install.sh

pack: ## build installable .shell-extension.zip archives
	./pack.sh

release: ## bump version, tag, and push — triggers the GitHub release workflow
	./release.sh
