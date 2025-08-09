# Debug GitHub Issue Command (v2.0)

This command implements systematic debugging for GitHub issues with fundamentals-first approach and comprehensive comment analysis.

## Usage
`/debug-github-issue [issue-number]` - Start or continue debugging a specific GitHub issue

## Overview

An improved systematic debugging approach that prioritizes fundamentals and learns from previous attempts. **All debug progress is tracked in GitHub issue comments** for team visibility and collaboration.

## How It Works

### Phase 0: Issue Analysis & History Review
1. **Fetch issue details**: `gh issue view [issue-number] --comments`
2. **Parse ALL existing comments** for previous debug attempts
3. **Extract already-fixed issues** from comment history
4. **Identify repeated patterns** to avoid
5. **Check for existing debug branch**: `debug/issue-${issue-number}-YYYY-MM-DD`
6. **Safety checks**: Ensure clean working directory

### Phase 1: Fundamentals-First Investigation
**MANDATORY CHECKLIST** (before any complex debugging):

#### Structural Validation
- [ ] **HTML structure check**: Forms, buttons, proper nesting
- [ ] **Component hierarchy**: Parent-child relationships correct
- [ ] **Event binding verification**: onClick, onSubmit, onChange connected
- [ ] **Element positioning**: Critical elements inside proper containers

#### Working Example Comparison  
- [ ] **Find similar working components** in codebase
- [ ] **Compare structure/patterns** side by side
- [ ] **Identify key differences** from working examples
- [ ] **Document baseline expectations** from working code

#### Basic Functionality Test
- [ ] **Console logging**: Add debugging at interaction points
- [ ] **Event flow verification**: Clicks → handlers → expected actions
- [ ] **State management check**: Data flows correctly
- [ ] **Network inspection**: API calls firing as expected

**⚠️ RULE: Cannot proceed to complex debugging until fundamentals checklist is complete**

### Phase 2: Systematic Debug Loop
For each debugging attempt:

1. **Post attempt comment** with hypothesis based on fundamentals
2. **Test single focused change** (no complex multi-step fixes)
3. **Verify basic functionality** still works after change
4. **Document results** with evidence (logs, screenshots, behavior)
5. **Commit with structured message**: `Fix #${issue-number}: Attempt N - [specific change]`

### Phase 3: Enhanced Circuit Breaker Logic

#### Automatic Triggers:
- **After 2 attempts**: Force fundamentals re-check
- **After 3 attempts**: Mandate working example comparison
- **After 4 attempts**: Auto-escalate with comprehensive summary
- **Repeated patterns**: Same hypothesis type attempted twice

#### Circuit Breaker Actions:
1. **Back-to-basics mode**: Force structural validation
2. **Working example deep-dive**: Mandatory comparison analysis  
3. **Team escalation**: Tag relevant team members with full context
4. **Pair debugging request**: Schedule collaborative session

### Phase 4: Resolution & Knowledge Capture

When issue is resolved:
1. **Post resolution comment** with root cause analysis
2. **Document lessons learned** for future prevention
3. **Update debugging knowledge base** with new patterns
4. **Create preventive measures** (linting rules, checklists, etc.)

## GitHub Comment Structure

### Initial Debug Session Comment
```markdown
🔍 **Debug Session Started v2.0**

**Issue**: #{issue-number} - {title}
**Debug Branch**: `debug/issue-{issue-number}-YYYY-MM-DD`
**Started**: {timestamp}
**Session ID**: `DEBUG-{issue-number}-{session-counter}`

## Comment History Analysis
{Summary of previous debug attempts and already-fixed issues}

## Fundamentals Checklist
- [ ] HTML structure validation
- [ ] Component hierarchy check  
- [ ] Event binding verification
- [ ] Working example comparison
- [ ] Basic functionality test

## Circuit Breaker v2.0
- Max attempts before fundamentals re-check: 2
- Max attempts before working example mandate: 3
- Auto-escalation: 4 attempts or repeated patterns
- Back-to-basics triggers: Structural issues, event flow problems

**⚠️ Must complete fundamentals checklist before complex debugging**

---
*Enhanced systematic debugging - fundamentals first, then complexity*
```

### Fundamentals Check Comment
```markdown
## 🔧 Fundamentals Check - {timestamp}

### Structural Validation
- **HTML Structure**: ✅ Forms properly nested, buttons inside forms
- **Component Hierarchy**: ✅ Parent-child relationships correct
- **Event Bindings**: ❌ onClick handler not connected to button
- **Element Positioning**: ❌ Submit button outside form element

### Working Example Analysis
- **Similar Component Found**: ContactEditForm.tsx (working)
- **Key Differences**:
  - Working: Button inside `<form>` with `onSubmit={handler}`
  - Broken: Button outside `</form>` - cannot trigger submission
- **Baseline Pattern**: Simple form with submit button inside form element

### Immediate Action Required
**Root Cause Identified**: Submit button positioned outside form structure
**Fix**: Move button inside form element
**Priority**: HIGH - Basic HTML structure issue

### Evidence
- No console logs on button click (event not reaching handler)
- Working example has different DOM structure
- HTML validation would catch this fundamental error

**Status**: 🚨 FUNDAMENTAL ISSUE FOUND - Proceeding with structural fix
```

### Circuit Breaker Escalation Comment  
```markdown
🚨 **Circuit Breaker Triggered v2.0**

After {N} attempts, escalating with enhanced analysis:

### Fundamentals Status
- **Structural Check**: {PASS/FAIL with details}
- **Working Example**: {COMPARED/NOT_COMPARED}  
- **Event Flow**: {VERIFIED/BROKEN}
- **Basic Functionality**: {WORKING/BROKEN}

### Debug Pattern Analysis
{Automatic analysis of repeated approaches}

### Recommended Next Steps
1. **If fundamentals failed**: Back-to-basics structural fix
2. **If patterns detected**: Try alternative approach from working examples
3. **If complex logic issue**: Pair debugging session needed
4. **If environment issue**: Infrastructure/build investigation

### Team Escalation
@{team-lead} @{relevant-expert} - Systematic debugging has reached limits.
- **Branch**: `debug/issue-{issue-number}-YYYY-MM-DD` 
- **All attempts**: Preserved in commit history
- **Fundamentals status**: {summary}
- **Recommended**: {specific next action}

---
*Enhanced circuit breaker - learns from patterns and enforces fundamentals*
```

## Command Implementation

Enhanced workflow with fundamentals-first approach:

```bash
# 1. Analyze issue history (NEW)
gh issue view $ISSUE_NUMBER --comments | parse_previous_debug_attempts

# 2. Extract already-fixed issues (NEW) 
grep -E "✅|FIXED|resolved" | extract_completed_items

# 3. Create/switch to debug branch
git checkout -b debug/issue-$ISSUE_NUMBER-$(date +%Y-%m-%d) 2>/dev/null || git checkout debug/issue-$ISSUE_NUMBER-$(date +%Y-%m-%d)

# 4. MANDATORY: Run fundamentals checklist (NEW)
run_fundamentals_check() {
  echo "🔧 Running fundamentals checklist..."
  check_html_structure
  find_working_examples  
  verify_event_bindings
  test_basic_functionality
}

# 5. Only proceed if fundamentals pass (NEW)
if [[ $FUNDAMENTALS_PASSED == "true" ]]; then
  begin_systematic_debugging
else
  post_fundamentals_failure_and_exit
fi

# 6. Enhanced circuit breaker monitoring (IMPROVED)
monitor_circuit_breaker() {
  local attempts=$(count_debug_attempts)
  local patterns=$(detect_repeated_patterns)
  
  if [[ $attempts -ge 2 ]]; then
    force_fundamentals_recheck
  elif [[ $attempts -ge 3 ]]; then  
    mandate_working_example_comparison
  elif [[ $attempts -ge 4 ]] || [[ $patterns == "detected" ]]; then
    auto_escalate_with_analysis
  fi
}
```

## Key Improvements v2.0

### 1. **Comment History Analysis**
- Parses all existing comments before starting
- Extracts already-completed work to avoid duplication
- Learns from previous failed approaches
- Builds on existing progress instead of restarting

### 2. **Fundamentals-First Mandatory Approach**
- Cannot proceed without completing structural validation
- Forces working example comparison early
- Catches basic issues (HTML structure, event binding) immediately
- Prevents over-engineering simple problems

### 3. **Enhanced Circuit Breaker Logic**
- Triggers earlier (after 2 attempts instead of 4)
- Forces specific actions based on failure type
- Detects and prevents repeated debugging patterns
- Auto-escalates with detailed analysis for team efficiency

### 4. **Working Example Integration**
- Makes comparison with working components mandatory
- Identifies baseline patterns from proven code
- Highlights deviations that may cause issues
- Uses working examples as debugging templates

### 5. **Evidence-Based Debugging**
- Requires proof of basic functionality before complex theories
- Documents evidence in every debugging step
- Maintains debugging knowledge base for future issues
- Creates preventive measures from lessons learned

## Success Metrics v2.0

Enhanced command aims to:
- **Catch fundamental issues in first 2 attempts** (vs 6+ in v1.0)
- **Reduce average debug time by 60%** through fundamentals-first
- **Eliminate repeated debugging patterns** via comment analysis
- **Improve team learning** through systematic knowledge capture
- **Increase debugging success rate** through working example comparison
- **Build institutional debugging knowledge** through enhanced documentation

---

**The key lesson: Always check the fundamentals first. Complex theories come after basic structure is verified.**