.PHONY: check typecheck test build

check:
	bash scripts/check-prereqs.sh

typecheck:
	npm run typecheck

test:
	npm test

build:
	npm run build
