// =============================================================================
// Agent Desk — System Monitor (status bar widget)
// =============================================================================

'use strict';

import { dom, registry } from './state.js';

// ---------------------------------------------------------------------------
// Status Bar Widget
// ---------------------------------------------------------------------------

let statsWidget = null;
let costWidget = null;
let costInterval = null;
let cleanupStatsListener = null;
let _costWarningShown = false;
const _agentCostWarnings = new Set();

function getColorClass(percent) {
  if (percent >= 85) return 'stat-critical';
  if (percent >= 60) return 'stat-warn';
  return 'stat-good';
}

function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + ' GB';
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(0) + ' MB';
}

function createStatsWidget() {
  const container = document.createElement('div');
  container.className = 'system-stats';
  container.title = 'System resource usage';

  container.innerHTML =
    '<span class="stat-item stat-cpu"><span class="stat-label">CPU</span> <span class="stat-value stat-good">\u2014</span></span>' +
    '<span class="stat-sep">\u00B7</span>' +
    '<span class="stat-item stat-ram"><span class="stat-label">RAM</span> <span class="stat-value stat-good">\u2014</span></span>' +
    '<span class="stat-sep">\u00B7</span>' +
    '<span class="stat-item stat-disk"><span class="stat-label">Disk</span> <span class="stat-value stat-good">\u2014</span></span>';

  return container;
}

function updateStatsWidget(stats) {
  if (!statsWidget) return;

  const cpuVal = statsWidget.querySelector('.stat-cpu .stat-value');
  const ramVal = statsWidget.querySelector('.stat-ram .stat-value');
  const diskVal = statsWidget.querySelector('.stat-disk .stat-value');

  if (cpuVal) {
    cpuVal.textContent = stats.cpu + '%';
    cpuVal.className = 'stat-value ' + getColorClass(stats.cpu);
  }
  if (ramVal) {
    ramVal.textContent = stats.ram.percent + '%';
    ramVal.className = 'stat-value ' + getColorClass(stats.ram.percent);
  }
  if (diskVal) {
    diskVal.textContent = stats.disk.percent + '%';
    diskVal.className = 'stat-value ' + getColorClass(stats.disk.percent);
  }

  const ramUsed = formatBytes(stats.ram.used);
  const ramTotal = formatBytes(stats.ram.total);
  const diskUsed = formatBytes(stats.disk.used);
  const diskTotal = formatBytes(stats.disk.total);
  statsWidget.title =
    'CPU: ' +
    stats.cpu +
    '%\n' +
    'RAM: ' +
    ramUsed +
    ' / ' +
    ramTotal +
    ' (' +
    stats.ram.percent +
    '%)\n' +
    'Disk: ' +
    diskUsed +
    ' / ' +
    diskTotal +
    ' (' +
    stats.disk.percent +
    '%)';
}

// ---------------------------------------------------------------------------
// Cost Widget
// ---------------------------------------------------------------------------

function createCostWidget() {
  const container = document.createElement('div');
  container.className = 'cost-widget';
  container.title = 'Estimated agent cost';

  container.innerHTML =
    '<span class="material-symbols-outlined cost-icon">payments</span>' + '<span class="cost-value">~$0.00</span>';

  return container;
}

function updateCostWidget() {
  if (!costWidget) return;
  if (typeof agentParser === 'undefined' || !agentParser.getTotalCost) return;

  const { totalCost, agents } = agentParser.getTotalCost();
  const anyParsed = agents.some((a) => a.hasParsedCost);
  const prefix = anyParsed ? '$' : '~$';
  const valueEl = costWidget.querySelector('.cost-value');
  if (valueEl) {
    valueEl.textContent = prefix + totalCost.toFixed(2);
    if (totalCost >= 5) {
      valueEl.className = 'cost-value stat-critical';
    } else if (totalCost >= 2) {
      valueEl.className = 'cost-value stat-warn';
    } else {
      valueEl.className = 'cost-value stat-good';
    }
  }

  const costLabel = anyParsed ? 'Cost' : 'Estimated Cost';
  let tip = costLabel + ': ' + prefix + totalCost.toFixed(2) + '\n';
  for (const a of agents) {
    const name = a.agentName || a.terminalId;
    const aPrefix = a.hasParsedCost ? '$' : '~$';
    tip += '\n' + name + ': ' + aPrefix + a.cost.toFixed(2);
    tip += ' (' + a.toolCalls + ' tools, ' + a.messages + ' msgs)';
  }
  if (agents.length === 0) tip += '\nNo active agents';
  costWidget.title = tip;

  if (totalCost >= 5 && !_costWarningShown) {
    _costWarningShown = true;
    if (registry.showToast) {
      registry.showToast('Cost warning: total estimated cost exceeds $5 (~$' + totalCost.toFixed(2) + ')');
    }
  }
  for (const a of agents) {
    if (a.cost >= 2 && !_agentCostWarnings.has(a.terminalId)) {
      _agentCostWarnings.add(a.terminalId);
      const name = a.agentName || a.terminalId;
      if (registry.showToast) {
        registry.showToast('Cost warning: ' + name + ' exceeds $2 (~$' + a.cost.toFixed(2) + ')');
      }
    }
  }
}

export function initSystemMonitor() {
  const right = dom.statusRight;
  if (!right) return;

  statsWidget = createStatsWidget();
  right.prepend(statsWidget);

  costWidget = createCostWidget();
  right.appendChild(costWidget);

  updateCostWidget();
  costInterval = setInterval(updateCostWidget, 5000);

  cleanupStatsListener = agentDesk.system.onStatsUpdate((stats) => {
    updateStatsWidget(stats);
  });

  agentDesk.system.getStats().then((stats) => {
    if (stats) {
      updateStatsWidget(stats);
    }
  });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function destroySystemMonitor() {
  if (cleanupStatsListener) {
    cleanupStatsListener();
    cleanupStatsListener = null;
  }
  if (costInterval) {
    clearInterval(costInterval);
    costInterval = null;
  }
  if (statsWidget && statsWidget.parentNode) {
    statsWidget.remove();
  }
  if (costWidget && costWidget.parentNode) {
    costWidget.remove();
  }
  statsWidget = null;
  costWidget = null;
}

registry.initSystemMonitor = initSystemMonitor;
registry.destroySystemMonitor = destroySystemMonitor;
