#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}" # help | deps | lint | jest | jest:watch | jest:file | test | sca | build | docker | secrets | all
ARG1="${2:-}"    # used for jest:file <pattern>

# ---------- helpers ----------
step() {
  echo
  echo "==> $1"
  echo "    $2"
}

die() {
  echo
  echo "❌ FAIL at: $1"
  echo "    What it checks: $2"
  if [[ -n "${3:-}" ]]; then
    echo "    Details:"
    echo -e "$3"
  fi
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

usage() {
  cat <<'EOF'
Usage:
  ./go-ci.sh [mode] [args]

Modes:
  help            Show this help
  deps            npm ci
  lint            npm run lint

  # Jest (developer-friendly)
  jest            npm test (fast, no coverage requirement)
  jest:watch      npm run test:watch (local watch mode)
  # jest:file <p>   run tests matching pattern <p> (file name or test name)

  # CI-style tests
  test            npm run test:cov (expects coverage/lcov.info)

  sca             npm audit --audit-level=high
  build           npm run build
  docker          docker compose build + docker build + optional trivy scan
  secrets         optional gitleaks scan
  all             run: deps -> lint -> test -> sca -> build -> docker -> secrets

Examples:
  ./go-ci.sh deps
  ./go-ci.sh lint
  ./go-ci.sh jest
  ./go-ci.sh jest:watch
  ./go-ci.sh jest:file user.service
  ./go-ci.sh test
  ./go-ci.sh all
EOF
}

if [[ "$MODE" == "help" || "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  usage
  exit 0
fi

run_deps() {
  step "npm ci (deps)" \
       "Installs dependencies deterministically from package-lock.json (same versions as CI)."
  npm ci || die "npm ci" "Dependency installation" "Run: npm ci"
}

run_lint() {
  step "lint (ESLint)" \
       "Checks code style + common TypeScript/JS issues."
  npm run lint || die "lint" "Code style / static lint rules" "Run: npm run lint"
  echo "    ✅ lint OK"
}

# -------- Jest-friendly modes (for devs) --------
run_jest() {
  step "jest (fast)" \
       "Runs Jest quickly (usually: npm test). Good for quick iterate/fix."
  npm test || die "jest" "Unit tests via Jest" "Run: npm test"
  echo "    ✅ jest OK"
}

run_jest_watch() {
  step "jest watch" \
       "Runs Jest in watch mode (local developer loop)."
  npm run test:watch || die "jest watch" "Jest watch mode" "Ensure package.json has: test:watch"
}

run_jest_file() {
  if [[ -z "$ARG1" ]]; then
    die "jest:file" "Target pattern required" "Usage: ./go-ci.sh jest:file <pattern>"
  fi

  step "jest file/pattern" \
       "Runs Jest matching a specific file/test pattern: $ARG1"
  # Works with Jest by forwarding pattern (either filename regex or testNamePattern depending config)
  # You can change to `--testNamePattern` if you prefer
  npm test -- "$ARG1" || die "jest:file" "Focused Jest run" "Try: ./go-ci.sh jest:file <pattern>"
  echo "    ✅ jest:file OK"
}

# -------- CI-style tests (coverage required) --------
run_test_cov() {
  step "unit tests + coverage" \
       "Runs Jest/Nest unit tests and generates coverage/lcov.info."
  npm run test:cov || die "unit tests" "Correctness of code via tests" "Run: npm run test:cov"

  if [[ ! -f "coverage/lcov.info" ]]; then
    die "coverage output" "Coverage file presence" "Expected: coverage/lcov.info not found"
  fi
  echo "    ✅ tests + coverage OK"
}

run_sca() {
  step "SCA (npm audit)" \
       "Checks dependency vulnerabilities. Fails on High+ by default."
  npm audit --audit-level=high || die "npm audit" "Dependency vulnerabilities (High+)" \
    "To inspect: npm audit\nTo fix: npm audit fix (review changes carefully)"
  echo "    ✅ npm audit OK"
}

run_build() {
  step "build" \
       "Compiles TypeScript and ensures the project can build successfully."
  npm run build || die "build" "Compilation/build step" "Run: npm run build"
  echo "    ✅ build OK"
}

run_docker() {
  step "docker compose build" \
       "Builds services from docker-compose.yml."
  need_cmd docker || die "docker" "Docker availability" "Install Docker Desktop / Docker Engine first"

  docker compose -f docker-compose.yml build || die "docker compose build" \
    "Build images from docker-compose.yml" \
    "Run: docker compose -f docker-compose.yml build"
  echo "    ✅ docker compose build OK"

  step "docker build (image)" \
       "Builds the main Dockerfile image locally."
  IMAGE_TAG="linklian-core:local"
  docker build -t "$IMAGE_TAG" -f Dockerfile . || die "docker build" \
    "Docker image build" \
    "Run: docker build -t linklian-core:local -f Dockerfile ."
  echo "    ✅ docker build OK"

  step "container scan (Trivy)" \
       "Scans the built image for HIGH/CRITICAL vulnerabilities."
  if need_cmd trivy; then
    trivy image --severity HIGH,CRITICAL --ignore-unfixed "$IMAGE_TAG" \
      || die "trivy scan" "Container vulnerabilities (HIGH/CRITICAL)" \
         "Install Trivy: https://aquasecurity.github.io/trivy (or brew install trivy)"
    echo "    ✅ trivy scan OK"
  else
    echo "    ⚠️ trivy not found -> skip local container scan (CI will still run it)"
  fi
}

run_secrets() {
  step "secret scan (optional local)" \
       "Looks for leaked secrets using gitleaks if installed."
  if need_cmd gitleaks; then
    gitleaks detect --redact --no-git || die "gitleaks" \
      "Secrets leaked in working tree" \
      "Install gitleaks then rerun: gitleaks detect --redact --no-git"
    echo "    ✅ gitleaks OK"
  else
    echo "    ⚠️ gitleaks not found -> skip local secret scan (CI will still run it)"
  fi
}

case "$MODE" in
  deps)        run_deps ;;
  lint)        run_deps; run_lint ;;
  jest)        run_deps; run_jest ;;
  jest:watch)  run_deps; run_jest_watch ;;
  jest:file)   run_deps; run_jest_file ;;
  test)        run_deps; run_test_cov ;;
  sca)         run_deps; run_sca ;;
  build)       run_deps; run_build ;;
  docker)      run_deps; run_docker ;;
  secrets)     run_deps; run_secrets ;;
  all)
    run_deps
    run_lint
    run_test_cov
    run_sca
    run_build
    run_docker
    run_secrets
    ;;
  *)
    echo "Unknown mode: $MODE"
    usage
    exit 2
    ;;
esac

echo
echo "✅ All requested checks passed (mode: $MODE)"
