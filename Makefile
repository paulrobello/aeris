.PHONY: build test lint fmt fmt-check typecheck checkall pre-commit pre-commit-update dev

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

fmt:
	npm run format

fmt-check:
	npm run format:check

typecheck:
	npm run typecheck

checkall: fmt-check lint typecheck test build
	npm run test:ssr

pre-commit:
	pre-commit run --all-files

pre-commit-update:
	pre-commit autoupdate
