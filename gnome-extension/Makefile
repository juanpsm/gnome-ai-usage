.PHONY: install pack schemas

schemas:
	glib-compile-schemas schemas

install: ## install the extension into the local GNOME session
	./install.sh

pack: ## build installable .shell-extension.zip archives
	./pack.sh
