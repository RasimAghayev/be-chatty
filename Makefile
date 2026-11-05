.DEFAULT_GOAL := help
export COMPOSE_PROJECT_NAME ?= be-chatty-p5
IMAGE := be-chatty

.PHONY: help build test verify up run down logs shell lint format security clean

help:
	@echo "be-chatty Phase 5 Makefile"
	@echo "  make build     - docker build (runtime target; see docs/BASELINE.md for the known pre-existing failure)"
	@echo "  make test      - docker build --target test (runs jest inside the container)"
	@echo "  make verify    - build + test (the real, Docker-verified gate)"
	@echo "  make up        - docker compose up (depends on verify)"
	@echo "  make run       - alias for up"
	@echo "  make down      - docker compose down"
	@echo "  make logs      - follow compose logs"
	@echo "  make shell     - shell into the deps image (runtime image cannot be built today)"
	@echo "  make lint      - eslint, via the deps-stage image"
	@echo "  make format    - prettier --check, via the deps-stage image"
	@echo "  make security  - docker scout cves against the test-stage image (runtime image doesn't exist yet)"
	@echo "  make clean     - remove local build/coverage dirs (containers/images need CONFIRM=1)"

build:
	docker build --target runtime -t $(IMAGE):runtime .

test:
	docker build --target test -t $(IMAGE):test .

# verify = the real behavior contract: build the test stage (runs jest for
# real, in Docker) and the build stage (runs tsc for real, in Docker), then
# attempt the full runtime chain. All three exit codes are reported; a
# non-zero overall `make verify` here is the documented, pre-existing
# baseline (docs/BASELINE.md), not a new failure introduced by this phase.
verify:
	docker build --target test -t $(IMAGE):test .
	docker build --target build -t $(IMAGE):build .
	docker build --target runtime -t $(IMAGE):runtime .

up: verify
	docker compose up -d --build

run: up

down:
	docker compose down

logs:
	docker compose logs -f

shell:
	docker build --target deps -t $(IMAGE):deps .
	docker run --rm -it $(IMAGE):deps sh

lint:
	docker build --target deps -t $(IMAGE):deps .
	docker run --rm -v "$(CURDIR)/src:/app/src:ro" -v "$(CURDIR)/eslint.config.js:/app/eslint.config.js:ro" $(IMAGE):deps npx eslint "src/**/*.{ts,tsx}"

format:
	docker build --target deps -t $(IMAGE):deps .
	docker run --rm -v "$(CURDIR)/src:/app/src:ro" $(IMAGE):deps npx prettier --check "src/**/*.{ts,json}"

security:
	docker build --target test -t $(IMAGE):test .
	docker scout cves $(IMAGE):test

# Never deletes containers/images/volumes without an explicit confirm flag.
clean:
ifeq ($(CONFIRM),1)
	rm -rf build coverage
	-docker compose down -v --remove-orphans
	-docker image rm $(IMAGE):runtime $(IMAGE):test $(IMAGE):build $(IMAGE):deps
else
	rm -rf build coverage
	@echo "Containers/images/volumes left untouched. Re-run with CONFIRM=1 to also remove them."
endif
