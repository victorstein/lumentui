#!/bin/bash
# fix-phase3-issues.sh - Script para corregir issues de Fase 3 Code Review
# Uso: ./scripts/fix-phase3-issues.sh [all|critical|medium|minor]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

EXCEPTIONS_FILE="src/modules/api/exceptions/shopify.exception.ts"
NORMALIZER_FILE="src/modules/api/utils/normalizer.util.ts"
SERVICE_FILE="src/modules/api/shopify/shopify.service.ts"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# C1: Fix custom exceptions
fix_c1_exceptions() {
    log_info "Fixing C1: Custom exceptions prototype fix..."
    
    if ! grep -q "Object.setPrototypeOf" "$EXCEPTIONS_FILE"; then
        log_info "Applying prototype fixes..."
        
        # Backup original
        cp "$EXCEPTIONS_FILE" "${EXCEPTIONS_FILE}.backup"
        
        # Apply fix to ShopifyException
        sed -i '/this.name = .ShopifyException./a\    Object.setPrototypeOf(this, ShopifyException.prototype);' "$EXCEPTIONS_FILE"
        
        # Apply fix to ShopifyAuthException
        sed -i '/this.name = .ShopifyAuthException./a\    Object.setPrototypeOf(this, ShopifyAuthException.prototype);' "$EXCEPTIONS_FILE"
        
        # Apply fix to ShopifyRateLimitException
        sed -i '/this.name = .ShopifyRateLimitException./a\    Object.setPrototypeOf(this, ShopifyRateLimitException.prototype);' "$EXCEPTIONS_FILE"
        
        log_success "Prototype fixes applied"
        
        # Show diff
        log_info "Changes made:"
        diff -u "${EXCEPTIONS_FILE}.backup" "$EXCEPTIONS_FILE" || true
        
        # Run tests
        log_info "Running tests..."
        npm test -- shopify.service.spec --silent
        
        if [ $? -eq 0 ]; then
            log_success "Tests passed! C1 fixed successfully"
            rm "${EXCEPTIONS_FILE}.backup"
        else
            log_error "Tests failed! Reverting changes..."
            mv "${EXCEPTIONS_FILE}.backup" "$EXCEPTIONS_FILE"
            exit 1
        fi
    else
        log_success "C1 already fixed (prototype chain present)"
    fi
}

# M1: Add ProductNormalizer validation
fix_m1_normalizer() {
    log_info "Fixing M1: ProductNormalizer edge case validation..."
    
    if ! grep -q "variants.length === 0" "$NORMALIZER_FILE"; then
        log_warning "This fix requires manual implementation"
        log_info "Steps:"
        echo "  1. Edit $NORMALIZER_FILE"
        echo "  2. Add validation:"
        echo "     if (!product.variants || product.variants.length === 0) {"
        echo "       throw new Error(\`Product \${product.id} has no variants\`);"
        echo "     }"
        echo "  3. Create tests: src/modules/api/utils/normalizer.util.spec.ts"
        echo "  4. Run: npm test -- normalizer.util.spec"
        log_warning "Skipping M1 (manual intervention required)"
    else
        log_success "M1 already fixed (validation present)"
    fi
}

# M2: Improve type safety in handleError
fix_m2_type_safety() {
    log_info "Fixing M2: Type-safe handleError..."
    
    if grep -q "handleError(error: any)" "$SERVICE_FILE"; then
        log_warning "This fix requires manual refactoring"
        log_info "Steps:"
        echo "  1. Edit $SERVICE_FILE"
        echo "  2. Change: private handleError(error: any)"
        echo "     To:     private handleError(error: unknown)"
        echo "  3. Add type guard:"
        echo "     private isAxiosError(error: unknown): error is AxiosError { ... }"
        echo "  4. Use type guard in handleError"
        echo "  5. Run: npm test -- shopify.service.spec"
        log_warning "Skipping M2 (manual intervention required)"
    else
        log_success "M2 already fixed (unknown type used)"
    fi
}

# Verify build
verify_build() {
    log_info "Verifying build..."
    npm run build --silent
    
    if [ $? -eq 0 ]; then
        log_success "Build successful!"
    else
        log_error "Build failed!"
        exit 1
    fi
}

# Run all tests
run_all_tests() {
    log_info "Running all tests..."
    npm test -- --silent
    
    if [ $? -eq 0 ]; then
        log_success "All tests passed!"
    else
        log_error "Some tests failed!"
        exit 1
    fi
}

# Main script
MODE="${1:-critical}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Phase 3 - Code Review Issues Fix Script               ║"
echo "║   Mode: $MODE"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

case "$MODE" in
    critical|c1)
        log_info "Mode: CRITICAL - Fixing only C1"
        fix_c1_exceptions
        verify_build
        log_success "Critical issues fixed! Ready to merge."
        ;;
        
    medium|m)
        log_info "Mode: MEDIUM - Fixing C1 + M1 + M2"
        fix_c1_exceptions
        fix_m1_normalizer
        fix_m2_type_safety
        verify_build
        log_warning "Medium issues require manual intervention (see above)"
        ;;
        
    all)
        log_info "Mode: ALL - Fixing all issues (C1 + M1 + M2 + Minor)"
        fix_c1_exceptions
        fix_m1_normalizer
        fix_m2_type_safety
        verify_build
        log_info "Manual fixes required for M1, M2, and minor issues"
        ;;
        
    *)
        log_error "Invalid mode: $MODE"
        echo "Usage: $0 [all|critical|medium|minor]"
        echo ""
        echo "Modes:"
        echo "  critical  - Fix only C1 (5 min, ready to merge)"
        echo "  medium    - Fix C1 + M1 + M2 (55 min total)"
        echo "  all       - Attempt to fix everything"
        exit 1
        ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Next Steps                                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "1. Review changes:"
echo "   git diff"
echo ""
echo "2. Run tests manually:"
echo "   npm test"
echo ""
echo "3. Commit changes:"
echo "   git add ."
echo "   git commit -m \"fix(api): Fix Phase 3 review issues ($MODE)\""
echo ""
echo "4. Check review reports:"
echo "   cat docs/reviews/PHASE3_EXECUTIVE_SUMMARY.md"
echo ""

log_success "Script completed!"
