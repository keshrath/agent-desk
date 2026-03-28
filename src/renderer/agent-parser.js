// =============================================================================
// Agent Desk — Claude Code Output Parser
// =============================================================================
// Parses Claude Code's markdown-formatted terminal output to detect tool calls,
// file modifications, test results, errors, and status changes. Emits structured
// events to the event bus.
// =============================================================================

'use strict';

// eslint-disable-next-line no-unused-vars
const agentParser = (function () {
  // -------------------------------------------------------------------------
  // Tool Detection Patterns
  // -------------------------------------------------------------------------

  // Claude Code tool call headers — look for the tool name in a header-like block
  // e.g. "Read(src/foo.ts)", "Edit(src/bar.js)", "Bash(npm test)"
  const TOOL_CALL_PATTERNS = [
    // Tool name with file/arg in parens: "Read(src/foo.ts)"
    /^(Read|Write|Edit|Bash|Grep|Glob|Agent|WebFetch|WebSearch|TodoRead|TodoWrite|Skill|ToolSearch|NotebookEdit)\(([^)]*)\)/,
    // Tool name followed by colon or bold: "**Read** src/foo.ts"
    /^\*{0,2}(Read|Write|Edit|Bash|Grep|Glob|Agent|WebFetch|WebSearch|TodoRead|TodoWrite|Skill|ToolSearch|NotebookEdit)\*{0,2}[\s:]+(.+)/,
    // Tool use block markers from Claude output
    /^\s*(?:Tool|Using)\s*:\s*(Read|Write|Edit|Bash|Grep|Glob|Agent|WebFetch|WebSearch|TodoRead|TodoWrite|Skill|ToolSearch|NotebookEdit)(?:\s*[-:]\s*(.*))?/i,
  ];

  // File path patterns in tool outputs
  const FILE_PATH_PATTERN =
    /(?:^|\s|["'`(])([A-Za-z]:[\\/][^\s"'`),]+|(?:\.{0,2}\/)?(?:src|lib|test|tests|app|config|public|dist)\/[^\s"'`),]+\.[a-zA-Z0-9]+)/g;

  // Test result patterns
  const TEST_PATTERNS = [
    { pattern: /(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?/i, type: 'pass' },
    { pattern: /(\d+)\s+(?:tests?\s+)?fail(?:ed|ing|ure)?/i, type: 'fail' },
    { pattern: /Tests?:\s*(\d+)\s+passed/i, type: 'pass' },
    { pattern: /Tests?:\s*(\d+)\s+failed/i, type: 'fail' },
    { pattern: /PASS\s+(\S+)/i, type: 'pass' },
    { pattern: /FAIL\s+(\S+)/i, type: 'fail' },
    { pattern: /All\s+(\d+)\s+tests?\s+passed/i, type: 'pass' },
    { pattern: /\u2713\s+(\d+)\s+test/i, type: 'pass' }, // checkmark
    { pattern: /\u2717\s+(\d+)\s+test/i, type: 'fail' }, // x mark
  ];

  // Error patterns
  const ERROR_PATTERNS = [
    /(?:Error|ERROR|error):\s+(.+)/,
    /(?:Exception|EXCEPTION):\s+(.+)/,
    /(?:FATAL|fatal|Fatal):\s+(.+)/,
    /(?:Traceback|traceback)\s*\(/,
    /(?:panic|PANIC):\s+(.+)/,
    /(?:Uncaught|unhandled)\s+/i,
    /npm\s+ERR!/,
    /SyntaxError:\s+(.+)/,
    /TypeError:\s+(.+)/,
    /ReferenceError:\s+(.+)/,
  ];

  // Status/thinking patterns
  const STATUS_PATTERNS = [
    { pattern: /Thinking\.\.\./i, status: 'thinking' },
    { pattern: /Running\.\.\./i, status: 'running' },
    { pattern: /Searching\.\.\./i, status: 'searching' },
    { pattern: /Analyzing\.\.\./i, status: 'analyzing' },
    { pattern: /^\s*\u280[0-9a-f]/, status: 'working' }, // braille spinner
    { pattern: /\u28ff|\u28fe|\u28f7/, status: 'working' },
    { pattern: /^\u23fa/, status: 'working' }, // ⏺ thinking indicator
    { pattern: /^\u25cf/, status: 'working' }, // ● indicator
  ];

  // Token usage patterns — Claude Code prints usage stats in various forms
  const TOKEN_USAGE_PATTERNS = [
    // "Input tokens: 1234" or "input: 1,234 tokens"
    { pattern: /input[\s_]*tokens?[\s:]+([0-9,]+)/i, field: 'input' },
    { pattern: /output[\s_]*tokens?[\s:]+([0-9,]+)/i, field: 'output' },
    // "Tokens: 1234 in / 567 out"
    { pattern: /tokens?[\s:]+([0-9,]+)\s*(?:in|input)/i, field: 'input' },
    { pattern: /tokens?[\s:]+([0-9,]+)\s*(?:out|output)/i, field: 'output' },
    // "Usage: 12.3k input, 4.5k output" — Claude Code's exact format
    { pattern: /([0-9.]+)k\s*input/i, field: 'input', multiplier: 1000 },
    { pattern: /([0-9.]+)k\s*output/i, field: 'output', multiplier: 1000 },
    // Plain number form: "15200 input"
    { pattern: /([0-9,]+)\s*input/i, field: 'input' },
    { pattern: /([0-9,]+)\s*output/i, field: 'output' },
  ];

  // Cost patterns — separate from token patterns for clarity
  const COST_PATTERNS = [
    // "Cost: $0.48 (session total: $2.15)" — Claude Code's exact format
    { pattern: /Cost:\s*\$([0-9]+\.[0-9]+)/, field: 'messageCost' },
    { pattern: /session\s*total:\s*\$([0-9]+\.[0-9]+)/i, field: 'sessionCost' },
    // Generic "$X.XX" in a cost/usage context
    { pattern: /(?:cost|price|charge|spent).*?\$([0-9]+\.[0-9]+)/i, field: 'messageCost' },
  ];

  // Assistant message patterns — detect when Claude responds
  const ASSISTANT_MSG_PATTERNS = [
    /^I'll\s/i,
    /^I\s+will\s/i,
    /^Let\s+me\s/i,
    /^Here(?:'s|\s+is)\s/i,
    /^Now\s+(?:I'll|let)\s/i,
    /^The\s+(?:file|code|error|issue|problem)\s/i,
    /^Done[.!]/i,
    /^Successfully\s/i,
  ];

  // Claude Code agent detection patterns
  const CLAUDE_DETECT_PATTERNS = [
    /^claude\s/i,
    /Claude Code/i,
    /Anthropic/i,
    /\bclaude\b.*\bcode\b/i,
    /^>\s*$/,
    /Tips for getting started/,
    /What would you like to do/,
    /I'll help you/,
    /^\u23fa\s/,
    /^\u2713\s+Usage:/,
    /session\s*total:\s*\$/i,
  ];

  // -------------------------------------------------------------------------
  // Per-terminal Agent Info
  // -------------------------------------------------------------------------

  /** @type {Map<string, object>} terminalId -> agentInfo */
  const _agentInfo = new Map();

  function _getOrCreateInfo(terminalId) {
    if (!_agentInfo.has(terminalId)) {
      _agentInfo.set(terminalId, {
        isAgent: false,
        lastTool: null,
        lastToolFile: null,
        filesModified: [],
        errors: [],
        toolCount: 0,
        recentTools: [], // last N tool calls for tooltip
        agentName: null,
        detectedAt: null,
        // Cost/token tracking
        messageCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        // Parsed cost from Claude Code output (direct, not estimated)
        parsedMessageCost: 0,
        parsedSessionCost: 0,
        hasParsedCost: false,
      });
    }
    return _agentInfo.get(terminalId);
  }

  // -------------------------------------------------------------------------
  // Parsing
  // -------------------------------------------------------------------------

  /**
   * Process a chunk of terminal output data.
   * Strips ANSI, splits into lines, and detects events.
   * @param {string} terminalId
   * @param {string} rawData - raw terminal output (may contain ANSI codes)
   */
  function parse(terminalId, rawData) {
    const cleaned = _stripAnsi(rawData);
    const lines = cleaned.split(/\r?\n/);
    const info = _getOrCreateInfo(terminalId);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Auto-detect if this is a Claude Code session
      if (!info.isAgent) {
        for (const pat of CLAUDE_DETECT_PATTERNS) {
          if (pat.test(trimmed)) {
            info.isAgent = true;
            info.detectedAt = Date.now();
            eventBus.emit('agent:detected', {
              terminalId,
              source: trimmed.slice(0, 80),
            });
            break;
          }
        }
      }

      // Detect tool calls
      _detectToolCall(terminalId, trimmed, info);

      // Detect test results
      _detectTestResult(terminalId, trimmed);

      // Detect errors
      _detectError(terminalId, trimmed, info);

      // Detect status changes
      _detectStatus(terminalId, trimmed);

      // Detect agent name from comm registration
      _detectAgentName(terminalId, trimmed, info);

      // Detect token usage from Claude output
      _detectTokenUsage(terminalId, trimmed, info);

      // Detect assistant messages for token estimation
      _detectAssistantMessage(trimmed, info);
    }
  }

  function _detectToolCall(terminalId, line, info) {
    for (const pattern of TOOL_CALL_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const tool = match[1];
        const arg = (match[2] || '').trim();

        info.toolCount++;
        info.lastTool = tool;
        info.lastToolFile = arg || null;

        info.recentTools.push({ tool, arg, time: Date.now() });
        if (info.recentTools.length > 5) info.recentTools.shift();

        // Estimate ~1000 input tokens per tool call when no direct usage data
        if (info.estimatedInputTokens === 0) {
          info.estimatedInputTokens = info.toolCount * 1000;
        }

        // Track file modifications
        if ((tool === 'Write' || tool === 'Edit') && arg) {
          if (!info.filesModified.includes(arg)) {
            info.filesModified.push(arg);
            if (info.filesModified.length > 50) info.filesModified.shift();

            eventBus.emit('agent:file-modified', {
              terminalId,
              file: arg,
              tool,
            });
          }
        }

        eventBus.emit('agent:tool-call', {
          terminalId,
          tool,
          arg,
          toolCount: info.toolCount,
        });
        return;
      }
    }

    // Also detect file paths in general output for file modification tracking
    if (info.isAgent) {
      const fileMatches = line.matchAll(FILE_PATH_PATTERN);
      for (const m of fileMatches) {
        const filePath = m[1];
        if (filePath && filePath.length > 3 && filePath.length < 200) {
          // Only emit for likely modification contexts
          if (/(?:writ|creat|modif|updat|edit|sav)/i.test(line)) {
            if (!info.filesModified.includes(filePath)) {
              info.filesModified.push(filePath);
              if (info.filesModified.length > 50) info.filesModified.shift();
              eventBus.emit('agent:file-modified', {
                terminalId,
                file: filePath,
                tool: 'detected',
              });
            }
          }
        }
      }
    }
  }

  function _detectTestResult(terminalId, line) {
    for (const tp of TEST_PATTERNS) {
      const match = line.match(tp.pattern);
      if (match) {
        eventBus.emit('agent:test-result', {
          terminalId,
          result: tp.type,
          detail: match[1] || line.slice(0, 100),
          line: line.slice(0, 150),
        });
        return;
      }
    }
  }

  function _detectError(terminalId, line, info) {
    for (const pattern of ERROR_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const errorMsg = (match[1] || line).slice(0, 200);
        info.errors.push({ message: errorMsg, time: Date.now() });
        if (info.errors.length > 20) info.errors.shift();

        eventBus.emit('error', {
          terminalId,
          message: errorMsg,
          source: 'agent-parser',
        });
        return;
      }
    }
  }

  function _detectStatus(terminalId, line) {
    for (const sp of STATUS_PATTERNS) {
      if (sp.pattern.test(line)) {
        eventBus.emit('agent:status', {
          terminalId,
          status: sp.status,
        });
        return;
      }
    }
  }

  function _detectAgentName(terminalId, line, info) {
    // Look for comm_register patterns or agent name in output
    const nameMatch = line.match(/(?:Registered as|Agent name|Session):\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    if (nameMatch) {
      info.agentName = nameMatch[1];
      eventBus.emit('agent:named', {
        terminalId,
        agentName: nameMatch[1],
      });
    }
  }

  function _stripAnsi(str) {
    return str
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
      .replace(/\x1b\][^\x07]*\x07/g, '')
      .replace(/\x1b[()][0-9A-B]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }

  // -------------------------------------------------------------------------
  // Token / Cost Detection
  // -------------------------------------------------------------------------

  function _detectTokenUsage(terminalId, line, info) {
    for (const cp of COST_PATTERNS) {
      const match = line.match(cp.pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (value >= 0 && value < 100000) {
          if (cp.field === 'sessionCost') {
            info.parsedSessionCost = value;
          } else {
            info.parsedMessageCost = value;
          }
          info.hasParsedCost = true;
          eventBus.emit('agent:cost-update', {
            terminalId,
            field: cp.field,
            value,
          });
        }
      }
    }

    for (const tp of TOKEN_USAGE_PATTERNS) {
      const match = line.match(tp.pattern);
      if (match) {
        let value = match[1].replace(/,/g, '');
        let tokens = parseFloat(value);
        // Apply explicit multiplier (e.g. "15.2k" patterns)
        if (tp.multiplier) {
          tokens *= tp.multiplier;
        }
        tokens = Math.round(tokens);
        if (tokens > 0 && tokens < 10000000) {
          if (tp.field === 'input') {
            info.estimatedInputTokens = tokens;
          } else {
            info.estimatedOutputTokens = tokens;
          }
          eventBus.emit('agent:token-usage', {
            terminalId,
            field: tp.field,
            tokens,
          });
        }
        return;
      }
    }
  }

  function _detectAssistantMessage(line, info) {
    if (!info.isAgent) return;
    for (const pattern of ASSISTANT_MSG_PATTERNS) {
      if (pattern.test(line)) {
        info.messageCount++;
        // Estimate tokens if no direct usage info: ~500 output tokens per message
        if (info.estimatedOutputTokens === 0) {
          info.estimatedOutputTokens = info.messageCount * 500;
        }
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Get agent info for a terminal.
   * @param {string} terminalId
   * @returns {object|null}
   */
  function getInfo(terminalId) {
    return _agentInfo.get(terminalId) || null;
  }

  /**
   * Check if a terminal is running an agent.
   * @param {string} terminalId
   * @returns {boolean}
   */
  function isAgent(terminalId) {
    const info = _agentInfo.get(terminalId);
    return info ? info.isAgent : false;
  }

  /**
   * Mark a terminal as running an agent (e.g. when command is "claude").
   * @param {string} terminalId
   * @param {string} [agentName]
   */
  function markAsAgent(terminalId, agentName) {
    const info = _getOrCreateInfo(terminalId);
    info.isAgent = true;
    info.detectedAt = Date.now();
    if (agentName) info.agentName = agentName;
  }

  /**
   * Get all terminals running agents.
   * @returns {Array<{terminalId: string, agentName: string|null, lastTool: string|null, toolCount: number}>}
   */
  function getAgentTerminals() {
    const result = [];
    for (const [terminalId, info] of _agentInfo) {
      if (info.isAgent) {
        result.push({
          terminalId,
          agentName: info.agentName,
          status: info.lastTool ? `${info.lastTool}` : 'idle',
          lastActivity: info.recentTools.length > 0 ? info.recentTools[info.recentTools.length - 1].time : null,
          lastTool: info.lastTool,
          toolCount: info.toolCount,
        });
      }
    }
    return result;
  }

  /**
   * Get cost/token estimates for a terminal.
   * @param {string} terminalId
   * @returns {{toolCalls: number, messages: number, estimatedTokens: number, estimatedCost: number}|null}
   */
  function getAgentCost(terminalId) {
    const info = _agentInfo.get(terminalId);
    if (!info || !info.isAgent) return null;

    const inputTokens =
      info.estimatedInputTokens > 0 ? info.estimatedInputTokens : info.toolCount * 1000 + info.messageCount * 200;
    const outputTokens =
      info.estimatedOutputTokens > 0 ? info.estimatedOutputTokens : info.messageCount * 500 + info.toolCount * 100;

    let cost;
    if (info.hasParsedCost && info.parsedSessionCost > 0) {
      cost = info.parsedSessionCost;
    } else if (info.hasParsedCost && info.parsedMessageCost > 0) {
      cost = info.parsedMessageCost;
    } else {
      const inputCost = (inputTokens / 1_000_000) * 15;
      const outputCost = (outputTokens / 1_000_000) * 75;
      cost = inputCost + outputCost;
    }

    return {
      toolCalls: info.toolCount,
      messages: info.messageCount,
      estimatedTokens: inputTokens + outputTokens,
      estimatedCost: cost,
      hasParsedCost: info.hasParsedCost,
    };
  }

  /**
   * Get aggregate cost across all agent terminals.
   * @returns {{totalCost: number, agents: Array<{terminalId: string, agentName: string|null, cost: number}>}}
   */
  function getTotalCost() {
    let totalCost = 0;
    const agents = [];
    for (const [terminalId, info] of _agentInfo) {
      if (!info.isAgent) continue;
      const cost = getAgentCost(terminalId);
      if (cost) {
        totalCost += cost.estimatedCost;
        agents.push({
          terminalId,
          agentName: info.agentName,
          cost: cost.estimatedCost,
          toolCalls: cost.toolCalls,
          messages: cost.messages,
          tokens: cost.estimatedTokens,
          hasParsedCost: cost.hasParsedCost,
        });
      }
    }
    return { totalCost, agents };
  }

  /**
   * Clean up info for a closed terminal.
   * @param {string} terminalId
   */
  function cleanup(terminalId) {
    _agentInfo.delete(terminalId);
  }

  return {
    parse,
    getInfo,
    isAgent,
    markAsAgent,
    getAgentTerminals,
    getAgentCost,
    getTotalCost,
    cleanup,
  };
})();
