SHELL := /bin/bash

.PHONY: help check bootstrap dns images plan deploy frontend verify recover destroy all \
	fmt validate api-build frontend-build scanner-test

help:
	@./rebuild-aws.sh help

check bootstrap dns images plan deploy frontend verify recover destroy all:
	@./rebuild-aws.sh $@

fmt:
	terraform fmt -check -recursive terraform/bootstrap/backend
	terraform fmt -check -recursive terraform/bootstrap/route53
	terraform fmt -check -recursive terraform/environments/staging

validate:
	terraform -chdir=terraform/bootstrap/backend validate
	terraform -chdir=terraform/bootstrap/route53 validate
	terraform -chdir=terraform/environments/staging validate

api-build:
	npm --prefix services/api run build

frontend-build:
	npm --prefix frontend/portal run build

scanner-test:
	python3 -m unittest discover -s services/scanner/cmd/scanner/tests -v
