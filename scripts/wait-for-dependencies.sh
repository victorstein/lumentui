#!/bin/bash
# Wait for Phases 5-6 completion monitoring script
# Checks every 2 minutes for required files

PROJECT_DIR="$HOME/clawd/development/lumentui/lumentui"
CHECK_INTERVAL=120  # 2 minutes
MAX_CHECKS=15       # 30 minutes total
CURRENT_CHECK=0

FILE1="$PROJECT_DIR/src/scheduler/scheduler.service.ts"
FILE2="$PROJECT_DIR/src/notification/notification.service.ts"

echo "🕐 [$(date '+%H:%M:%S')] Monitoring started - waiting for Phases 5-6 completion"
echo "📋 Checking for:"
echo "   - src/scheduler/scheduler.service.ts"
echo "   - src/notification/notification.service.ts"
echo ""
echo "⏱️  Check interval: 2 minutes"
echo "⌛ Timeout: 30 minutes (15 checks)"
echo ""

while [ $CURRENT_CHECK -lt $MAX_CHECKS ]; do
    CURRENT_CHECK=$((CURRENT_CHECK + 1))
    ELAPSED=$((CURRENT_CHECK * 2))
    
    echo "🔍 Check #$CURRENT_CHECK/$MAX_CHECKS (${ELAPSED} min elapsed)..."
    
    # Check if both files exist
    if [ -f "$FILE1" ] && [ -f "$FILE2" ]; then
        echo ""
        echo "✅ SUCCESS! Both files detected:"
        echo "   ✓ $(basename $FILE1)"
        echo "   ✓ $(basename $FILE2)"
        echo ""
        echo "🚀 Phases 5-6 complete - ready to proceed with Phase 7"
        exit 0
    fi
    
    # Show which files are missing
    if [ ! -f "$FILE1" ]; then
        echo "   ⏳ Missing: scheduler.service.ts"
    else
        echo "   ✓ Found: scheduler.service.ts"
    fi
    
    if [ ! -f "$FILE2" ]; then
        echo "   ⏳ Missing: notification.service.ts"
    else
        echo "   ✓ Found: notification.service.ts"
    fi
    
    # Don't sleep on last iteration
    if [ $CURRENT_CHECK -lt $MAX_CHECKS ]; then
        echo "   💤 Sleeping 2 minutes..."
        echo ""
        sleep $CHECK_INTERVAL
    fi
done

echo ""
echo "❌ TIMEOUT: Phases 5-6 not completed after 30 minutes"
echo "📊 Status:"
[ -f "$FILE1" ] && echo "   ✓ scheduler.service.ts exists" || echo "   ✗ scheduler.service.ts missing"
[ -f "$FILE2" ] && echo "   ✓ notification.service.ts exists" || echo "   ✗ notification.service.ts missing"
echo ""
exit 1
