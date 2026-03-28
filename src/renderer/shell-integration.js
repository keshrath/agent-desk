// =============================================================================
// Shell Integration — OSC sequence parser for Agent Desk
// =============================================================================
// Parses OSC escape sequences from terminal output to provide:
// - Current directory tracking (OSC 7, OSC 1337;CurrentDir)
// - Command boundary detection (OSC 133 A/B/C/D marks)
// - Scroll marks (OSC 1337;SetMark)
// =============================================================================

'use strict';

// eslint-disable-next-line no-unused-vars
const ShellIntegration = (function () {
  // ---------------------------------------------------------------------------
  // Per-terminal State
  // ---------------------------------------------------------------------------

  const _terminalStates = new Map();

  function _getState(terminalId) {
    if (!_terminalStates.has(terminalId)) {
      _terminalStates.set(terminalId, {
        cwd: null,
        integrationActive: false,
        currentCommand: null,
        commands: [],
        lastExitCode: null,
        promptStartLine: null,
        commandStartLine: null,
        outputStartLine: null,
      });
    }
    return _terminalStates.get(terminalId);
  }

  // ---------------------------------------------------------------------------
  // OSC Parsing
  // ---------------------------------------------------------------------------

  const OSC_REGEX = /\x1b\](\d+);?([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

  /**
   * Process terminal data for OSC sequences.
   * Does NOT strip them from the stream — xterm.js handles/ignores them.
   * Returns an object with any detected events.
   */
  function processData(terminalId, data, currentLineCount) {
    const tState = _getState(terminalId);
    const events = [];

    let match;
    OSC_REGEX.lastIndex = 0;

    while ((match = OSC_REGEX.exec(data)) !== null) {
      const oscNumber = parseInt(match[1], 10);
      const oscData = match[2];

      if (oscNumber === 7) {
        const dir = _parseOsc7(oscData);
        if (dir) {
          tState.cwd = dir;
          tState.integrationActive = true;
          events.push({ type: 'cwd', path: dir });
        }
      } else if (oscNumber === 133) {
        _handleOsc133(tState, oscData, currentLineCount, events);
      } else if (oscNumber === 1337) {
        _handleOsc1337(tState, oscData, events);
      }
    }

    return events;
  }

  /**
   * Parse OSC 7 (CurrentDir): file:///path/to/dir
   */
  function _parseOsc7(data) {
    if (!data) return null;
    try {
      if (data.startsWith('file://')) {
        const url = new URL(data);
        let path = decodeURIComponent(url.pathname);
        if (/^\/[A-Z]:\//i.test(path)) {
          path = path.substring(1);
        }
        return path;
      }
      return data;
    } catch (_e) {
      return data;
    }
  }

  /**
   * Handle OSC 133 (Command marks / Shell Integration Protocol).
   */
  function _handleOsc133(tState, data, currentLineCount, events) {
    tState.integrationActive = true;

    const parts = data.split(';');
    const mark = parts[0];

    switch (mark) {
      case 'A':
        tState.promptStartLine = currentLineCount;
        events.push({ type: 'prompt-start', line: currentLineCount });
        break;

      case 'B':
        tState.commandStartLine = currentLineCount;
        events.push({ type: 'command-start', line: currentLineCount });
        break;

      case 'C':
        tState.outputStartLine = currentLineCount;
        events.push({ type: 'output-start', line: currentLineCount });
        break;

      case 'D': {
        const exitCode = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        tState.lastExitCode = exitCode;

        const command = {
          exitCode,
          startLine: tState.commandStartLine,
          outputStartLine: tState.outputStartLine,
          endLine: currentLineCount,
          timestamp: Date.now(),
        };

        tState.commands.push(command);

        if (tState.commands.length > 100) {
          tState.commands = tState.commands.slice(-100);
        }

        tState.commandStartLine = null;
        tState.outputStartLine = null;
        tState.promptStartLine = null;

        events.push({ type: 'command-end', exitCode, command });
        break;
      }
    }
  }

  /**
   * Handle OSC 1337 (iTerm2 extensions).
   */
  function _handleOsc1337(tState, data, events) {
    if (data.startsWith('CurrentDir=')) {
      const dir = data.substring('CurrentDir='.length);
      if (dir) {
        tState.cwd = dir;
        tState.integrationActive = true;
        events.push({ type: 'cwd', path: dir });
      }
    } else if (data === 'SetMark') {
      events.push({ type: 'mark' });
    }
  }

  // ---------------------------------------------------------------------------
  // Query API
  // ---------------------------------------------------------------------------

  function getCwd(terminalId) {
    const tState = _terminalStates.get(terminalId);
    return tState ? tState.cwd : null;
  }

  function isActive(terminalId) {
    const tState = _terminalStates.get(terminalId);
    return tState ? tState.integrationActive : false;
  }

  function getLastExitCode(terminalId) {
    const tState = _terminalStates.get(terminalId);
    return tState ? tState.lastExitCode : null;
  }

  function getLastCommand(terminalId) {
    const tState = _terminalStates.get(terminalId);
    if (!tState || tState.commands.length === 0) return null;
    return tState.commands[tState.commands.length - 1];
  }

  function getCommands(terminalId) {
    const tState = _terminalStates.get(terminalId);
    return tState ? [...tState.commands] : [];
  }

  function cleanup(terminalId) {
    _terminalStates.delete(terminalId);
  }

  // ---------------------------------------------------------------------------
  // Shell Setup Snippets
  // ---------------------------------------------------------------------------

  const SHELL_SETUP_SNIPPETS = {
    bash: `# Add to ~/.bashrc
PS1='\\[\\e]133;A\\a\\]\\[\\e]7;file://\${HOSTNAME}\${PWD}\\a\\]\\u@\\h:\\w\\$ \\[\\e]133;B\\a\\]'
_prompt_command() {
  local exit_code=$?
  printf '\\e]133;D;%d\\a' "$exit_code"
}
PROMPT_COMMAND="_prompt_command\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
trap 'printf "\\e]133;C\\a"' DEBUG`,

    zsh: `# Add to ~/.zshrc
_osc133_precmd() {
  print -Pn '\\e]133;D;%?\\a'
  print -Pn '\\e]133;A\\a'
  print -Pn '\\e]7;file://%M%~\\a'
}
_osc133_preexec() {
  print -Pn '\\e]133;B\\a'
  print -Pn '\\e]133;C\\a'
}
precmd_functions+=(_osc133_precmd)
preexec_functions+=(_osc133_preexec)`,

    fish: `# Add to ~/.config/fish/conf.d/shell-integration.fish
function __osc133_prompt --on-event fish_prompt
  printf '\\e]133;D;%d\\a' $status
  printf '\\e]133;A\\a'
  printf '\\e]7;file://%s%s\\a' (hostname) (pwd)
end
function __osc133_preexec --on-event fish_preexec
  printf '\\e]133;B\\a'
  printf '\\e]133;C\\a'
end`,

    powershell: `# Add to $PROFILE
function prompt {
  $exitCode = if ($?) { 0 } else { 1 }
  "$([char]0x1b)]133;D;$exitCode$([char]0x07)" +
  "$([char]0x1b)]133;A$([char]0x07)" +
  "$([char]0x1b)]7;file:///$($PWD.Path -replace '\\\\','/')$([char]0x07)" +
  "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) " +
  "$([char]0x1b)]133;B$([char]0x07)"
}`,
  };

  function getSetupSnippet(shell) {
    return SHELL_SETUP_SNIPPETS[shell] || null;
  }

  function getAvailableShells() {
    return Object.keys(SHELL_SETUP_SNIPPETS);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    processData,
    getCwd,
    isActive,
    getLastExitCode,
    getLastCommand,
    getCommands,
    cleanup,
    getSetupSnippet,
    getAvailableShells,
  };
})();
