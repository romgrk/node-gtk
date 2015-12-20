.PHONY: build default release

VERSION := $(shell node -e "console.log(require('./package.json').version)")
BOLD := $(shell tput bold)
RED := $(shell tput setaf 1)
RESET := $(shell tput sgr0)

build:
	@echo "Did you mean 'make release' ?"

default:
	@echo "Did you mean 'make release' ?"

release:
	@if [ $(NODE_PRE_GYP_GITHUB_TOKEN) = "" ]; then echo "$(RED)Please specify a $(BOLD)NODE_PRE_GYP_GITHUB_TOKEN$(RESET)"; echo ""; exit 1; fi
	@echo "Current Version: $(BOLD)$(VERSION)$(RESET)"
	@if [ "$(TAG)" = "" ]; then echo "$(BOLD)$(RED)Please specify a new version$(RESET)"; fi
	@if [ "$(TAG)" = "" ]; then echo "$(BOLD)TAG=$(VERSION)1 make release$(RESET)"; echo ""; exit 1; fi
	@if [ "$(TAG)" = $(VERSION) ]; then echo "$(BOLD)$(RED)Please specify a different version$(RESET)"; echo ""; exit 1; fi
	@echo "Creating Release: $(BOLD)$(TAG)$(RESET)"
	@echo ""
	@node -e "var pkg=require('./package.json');pkg.version='$(TAG)';pkg.binary.host=pkg.binary.host.replace(/\/\d+\.\d+\.\d+\$$/,'/$(TAG)');require('fs').writeFileSync('./package.json', JSON.stringify(pkg,null,'  '));"
	@echo "Building Package"
	./node_modules/node-pre-gyp/bin/node-pre-gyp configure
	./node_modules/node-pre-gyp/bin/node-pre-gyp rebuild
	node-pre-gyp-github package
	@echo "Adding updated package.json"
	@git add .
	@git commit -m "Release $(TAG)"
	@git push
	@echo "Tagging master Release $(BOLD)$(TAG)$(RESET)"
	@git tag -m "Release $(TAG)" $(TAG)
	@echo "Pushing master tags to GitHub"
	@git push --tags
	NODE_PRE_GYP_GITHUB_TOKEN="$(NODE_PRE_GYP_GITHUB_TOKEN)" node-pre-gyp-github publish
	@echo "Publishing to npm"
	npm publish
