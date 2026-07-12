const MODE_PROFILES = {
  quick: {
    label: 'Quick',
    detail: 'Fast, contained execution with a narrow verification pass.',
    phaseLimit: 3
  },
  standard: {
    label: 'Standard',
    detail: 'Balanced implementation with workspace context and targeted tests.',
    phaseLimit: 5
  },
  deep: {
    label: 'Deep',
    detail: 'Architecture-first execution with broad verification and risk review.',
    phaseLimit: 7
  }
};

export function createMissionBrief({ prompt, workspaceIntelligence, mode = 'standard' }) {
  const cleanPrompt = String(prompt ?? '').replace(/\s+/g, ' ').trim();
  if (!cleanPrompt) {
    const error = new Error('Mission prompt is required.');
    error.status = 400;
    throw error;
  }

  const selectedMode = normalizeTaskMode(mode);
  const intent = classifyIntent(cleanPrompt);
  const complexity = assessComplexity(cleanPrompt, intent, workspaceIntelligence);
  const recommendedMode = complexity.score >= 64 ? 'deep' : complexity.score <= 30 ? 'quick' : 'standard';
  const phases = buildPhases(intent, selectedMode, workspaceIntelligence).slice(0, MODE_PROFILES[selectedMode].phaseLimit);
  const guardrails = buildGuardrails(intent, selectedMode, workspaceIntelligence);
  const workspaceSignals = buildWorkspaceSignals(workspaceIntelligence);

  return {
    generatedAt: new Date().toISOString(),
    objective: objectiveFromPrompt(cleanPrompt),
    intent,
    selectedMode,
    recommendedMode,
    modeProfile: MODE_PROFILES[selectedMode],
    complexity,
    phases,
    guardrails,
    workspaceSignals,
    estimatedScope: estimateScope(complexity.score, intent, workspaceIntelligence),
    readiness: workspaceIntelligence?.score ?? null
  };
}

export function normalizeTaskMode(mode) {
  const value = String(mode ?? '').trim().toLowerCase();
  return value === 'quick' || value === 'deep' ? value : 'standard';
}

export function taskModeInstructions(mode) {
  const normalized = normalizeTaskMode(mode);
  if (normalized === 'quick') {
    return [
      'Execution profile: QUICK.',
      'Keep scope tightly contained, prefer the smallest safe change, and run one focused verification.',
      'Do not expand into adjacent refactors unless they are required for correctness.'
    ].join('\n');
  }
  if (normalized === 'deep') {
    return [
      'Execution profile: DEEP.',
      'Inspect architecture and existing behavior before editing, address the request as a cohesive system, and verify broadly.',
      'Preserve unrelated user work, call out residual risks, and do not stop at surface polish when underlying structure needs repair.'
    ].join('\n');
  }
  return [
    'Execution profile: STANDARD.',
    'Implement the complete requested outcome, preserve surrounding behavior, and run targeted verification proportional to the change.'
  ].join('\n');
}

function classifyIntent(prompt) {
  const text = prompt.toLowerCase();
  const scores = {
    repair: countMatches(text, ['fix', 'bug', 'broken', 'error', 'crash', 'repair', 'regression']),
    build: countMatches(text, ['build', 'create', 'add', 'implement', 'make', 'develop']),
    transform: countMatches(text, ['revamp', 'redesign', 'transform', 'rewrite', 'overhaul', 'rebuild', 'modernize']),
    verify: countMatches(text, ['test', 'verify', 'validate', 'check', 'audit', 'diagnose', 'profile']),
    explain: countMatches(text, ['explain', 'document', 'summarize', 'review', 'understand']),
    release: countMatches(text, ['release', 'publish', 'deploy', 'ship', 'github', 'installer'])
  };
  if (scores.transform > 0 && countMatches(text, ['fully', 'entire', 'every', 'all', 'giant', 'huge']) > 0) {
    scores.transform += 2;
  }
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [kind, score] = ordered[0];
  const labels = {
    repair: 'Repair and stabilize',
    build: 'Build capability',
    transform: 'Transform system',
    verify: 'Audit and verify',
    explain: 'Analyze and explain',
    release: 'Prepare and release'
  };
  return {
    kind: score > 0 ? kind : 'build',
    label: score > 0 ? labels[kind] : labels.build,
    confidence: Math.min(0.98, 0.58 + score * 0.1)
  };
}

function assessComplexity(prompt, intent, intelligence) {
  const text = prompt.toLowerCase();
  let score = Math.min(28, Math.ceil(prompt.length / 18));
  const reasons = [];
  const broadTerms = ['entire', 'every', 'fully', 'giant', 'huge', 'all', 'rewrite', 'architecture', 'end-to-end', 'production'];
  const riskyTerms = ['database', 'migration', 'authentication', 'security', 'payment', 'installer', 'release', 'api', 'backend'];
  const broadCount = countMatches(text, broadTerms);
  const riskyCount = countMatches(text, riskyTerms);
  const actionCount = countMatches(text, ['build', 'fix', 'test', 'refactor', 'rewrite', 'design', 'publish', 'release', 'deploy', 'document', 'migrate']);

  if (broadCount > 0) {
    score += Math.min(26, broadCount * 8);
    reasons.push('Broad system scope');
  }
  if (riskyCount > 0) {
    score += Math.min(22, riskyCount * 5);
    reasons.push('High-impact subsystem');
  }
  if (actionCount >= 3) {
    score += 12;
    reasons.push('Multiple execution stages');
  }
  if (intent.kind === 'transform') {
    score += 14;
    reasons.push('Transformation request');
  }
  if (intent.kind === 'release') {
    score += 8;
    reasons.push('Release coordination');
  }
  if ((intelligence?.metrics?.files ?? 0) > 1000) {
    score += 8;
    reasons.push('Large workspace');
  }
  if ((intelligence?.metrics?.dirtyFiles ?? 0) > 10) {
    score += 6;
    reasons.push('Existing local changes');
  }
  score = Math.max(8, Math.min(100, score));
  if (reasons.length === 0) reasons.push(score <= 30 ? 'Contained request' : 'Multi-step implementation');
  return {
    score,
    level: score >= 64 ? 'high' : score >= 38 ? 'medium' : 'low',
    reasons: reasons.slice(0, 4)
  };
}

function buildPhases(intent, mode, intelligence) {
  const phases = [
    { id: 'orient', title: 'Orient', detail: workspaceOrientation(intelligence), icon: 'scan' }
  ];
  if (mode !== 'quick') {
    phases.push({ id: 'plan', title: 'Map approach', detail: `Resolve dependencies and define the ${intent.label.toLowerCase()} path.`, icon: 'map' });
  }
  if (intent.kind === 'repair') {
    phases.push({ id: 'diagnose', title: 'Isolate cause', detail: 'Reproduce the failure and trace it to the smallest responsible layer.', icon: 'pulse' });
  }
  phases.push({
    id: 'execute',
    title: intent.kind === 'transform' ? 'Transform' : intent.kind === 'verify' ? 'Inspect' : 'Execute',
    detail: executionDetail(intent.kind),
    icon: 'bolt'
  });
  if (mode === 'deep') {
    phases.push({ id: 'integrate', title: 'Integrate', detail: 'Reconcile architecture, states, edge cases, and operator experience.', icon: 'nodes' });
  }
  phases.push({ id: 'verify', title: 'Verify', detail: verificationDetail(intelligence, mode), icon: 'check' });
  if (mode === 'deep' || intent.kind === 'release') {
    phases.push({ id: 'handoff', title: 'Handoff', detail: 'Summarize evidence, residual risk, and the exact shipped outcome.', icon: 'flag' });
  }
  return phases.map((phase, index) => ({ ...phase, index: index + 1 }));
}

function buildGuardrails(intent, mode, intelligence) {
  const guardrails = ['Preserve unrelated operator changes'];
  if (intelligence?.git?.dirty) guardrails.push('Inspect the dirty worktree before editing overlapping files');
  if (intent.kind === 'release') guardrails.push('Publish only after build and behavioral checks pass');
  if ((intelligence?.metrics?.testFiles ?? 0) === 0) guardrails.push('Establish a repeatable verification path before claiming completion');
  if (mode === 'deep') guardrails.push('Prefer durable architecture over local patches');
  if (mode === 'quick') guardrails.push('Do not expand beyond the requested surface');
  guardrails.push('Keep secrets and workspace content local');
  return [...new Set(guardrails)].slice(0, 5);
}

function buildWorkspaceSignals(intelligence) {
  if (!intelligence || intelligence.status !== 'ready') {
    return [{ label: 'Workspace', value: 'Unscanned', tone: 'watch' }];
  }
  const dominant = intelligence.languages?.[0]?.name ?? 'Mixed';
  const stack = intelligence.stack?.slice(0, 2).map((entry) => entry.name).join(' + ') || dominant;
  return [
    { label: 'Stack', value: stack, tone: 'info' },
    { label: 'Git', value: intelligence.git?.branch ?? 'No repository', tone: intelligence.git?.dirty ? 'watch' : 'good' },
    { label: 'Tests', value: `${intelligence.metrics?.testFiles ?? 0} detected`, tone: (intelligence.metrics?.testFiles ?? 0) > 0 ? 'good' : 'watch' },
    { label: 'Readiness', value: `${intelligence.score}%`, tone: intelligence.score >= 80 ? 'good' : 'watch' }
  ];
}

function estimateScope(score, intent, intelligence) {
  const files = intelligence?.metrics?.files ?? 0;
  const scale = score >= 64 ? 'System-wide' : score >= 38 ? 'Multi-file' : 'Focused';
  const verification = intent.kind === 'release' || score >= 64 ? 'full suite' : score >= 38 ? 'targeted suite' : 'focused check';
  return { scale, verification, projectFiles: files };
}

function workspaceOrientation(intelligence) {
  if (!intelligence || intelligence.status !== 'ready') return 'Validate the workspace boundary and inspect relevant files.';
  const project = intelligence.identity?.name ?? 'the project';
  const stack = intelligence.stack?.slice(0, 3).map((entry) => entry.name).join(', ') || 'its detected stack';
  return `Map ${project}, its ${stack} architecture, and current Git state.`;
}

function verificationDetail(intelligence, mode) {
  const commands = intelligence?.scripts?.filter((script) => /test|check|lint|build/i.test(script.name)).slice(0, 2) ?? [];
  if (commands.length > 0) return `Run ${commands.map((script) => script.command).join(' and ')}${mode === 'deep' ? ', then inspect the packaged result' : ''}.`;
  return mode === 'quick' ? 'Run the narrowest available behavioral check.' : 'Build the project and validate the affected behavior end to end.';
}

function executionDetail(kind) {
  if (kind === 'repair') return 'Apply the root-cause fix and protect the corrected behavior.';
  if (kind === 'transform') return 'Rebuild the experience and supporting internals as one coherent system.';
  if (kind === 'verify') return 'Collect evidence, rank findings, and prove the highest-risk paths.';
  if (kind === 'explain') return 'Trace the system and communicate the answer with concrete evidence.';
  if (kind === 'release') return 'Finish release-critical changes and prepare a verifiable publication.';
  return 'Implement the requested capability through the appropriate project layers.';
}

function objectiveFromPrompt(prompt) {
  const normalized = prompt.replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '');
  if (normalized.length <= 128) return normalized;
  return `${normalized.slice(0, 125).trimEnd()}…`;
}

function countMatches(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}
