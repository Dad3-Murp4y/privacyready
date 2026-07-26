# Continuous Integration & Deployment (CI/CD)

The PrivacyReady SaaS platform uses a fully automated GitLab CI/CD pipeline defined in `.gitlab-ci.yml`. The pipeline manages everything from code linting and security scanning to infrastructure provisioning and frontend deployment.

## Pipeline Stages

The pipeline is broken down into sequential stages. If any non-manual job fails, the pipeline halts immediately to prevent broken code from reaching production.

### 1. `lint-and-test`
Runs immediately on all commits to ensure code quality.
- **`backend-lint-test`**: Runs Python `pytest`, `flake8`, `black`, and `isort` on all backend services.
- **`frontend-lint-test`**: Runs `npm run lint` and `npm run test` for the static marketing site.
- **`portal-lint-test`**: Runs `npm run lint` and `npm run test` for the React Admin Portal.

### 2. `security-scan`
Security auditing for vulnerabilities and exposed secrets.
- **`npm-security-audit`**: Runs `npm audit` on frontend and backend Node.js projects to block high-severity vulnerabilities.
- **GitLab Native Scanners**: Automatically includes SAST (Static Application Security Testing), Secret Detection, and Dependency Scanning.

### 3. `infrastructure`
Manages AWS infrastructure using Terraform. **Changes here require manual approval.**
- **`persistent-plan` & `persistent-apply`**: Manages core infrastructure that is rarely destroyed (GitLab EC2, Route53 DNS, SSL Certificates, SES, Management VPC).
- **`terraform-plan` & `terraform-apply`**: Manages the Production application environment (Production VPC, ALB, ECS Clusters, RDS databases).
- **`terraform-destroy`**: ⚠️ **DANGER:** Completely destroys the Production application environment.

### 4. `build-and-scan`
Builds Docker images for backend services and scans them for OS-level vulnerabilities.
- **`docker-build-*`**: Compiles the `api`, `scanner`, and `dsr` services into Docker images.
- **`trivy-scan-*`**: Scans the compiled Docker images for CVEs using Aqua Trivy.

### 5. `deploy`
Pushes code to live AWS resources.
- **`deploy-api`, `deploy-scanner`, `deploy-dsr`**: Pushes Docker images to ECR and forces a rolling update on the ECS cluster.
- **`deploy-frontend`**: Syncs the static marketing site to the frontend S3 bucket and invalidates the CloudFront cache.
- **`deploy-portal`**: Compiles and syncs the React Admin Portal to its respective S3 bucket.

### 6. `cost-saver`
Manual utility jobs for environment lifecycle management. These jobs are configured to `allow_failure: true`, meaning they will not block automated deployments.
- **`prod-environment-shutdown`**: Stops the production RDS database and destroys expensive active resources (ALB, ECS, NAT Gateways).
- **`prod-environment-startup`**: Starts the production RDS database and recreates active resources via Terraform.
- **`test-environment-shutdown`**: Takes the test environment offline to save costs.
- **`test-environment-startup`**: Brings the test environment back online.

### 7. `.post`
Runs after all other stages have completed (or failed).
- **`dast-security-check`**: Pings the live API endpoint to ensure it returns a `200 OK` and validates the presence of strict security headers (e.g., `strict-transport-security`, `x-frame-options`). This job is allowed to fail so it doesn't break the pipeline if the environment is in maintenance mode.
