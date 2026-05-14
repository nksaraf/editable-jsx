/**
 * Editor panel CSS — injected into a Shadow DOM root
 * to prevent style leakage into the host page.
 */
export const EDITOR_STYLES = /* css */ `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #e2e8f0;
    line-height: 1.5;
  }

  * { box-sizing: border-box; }

  /* ── Panel container ──────────────────────────────────── */

  .css-editor-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 340px;
    max-height: calc(100vh - 32px);
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.5);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.2s, height 0.2s;
  }

  .css-editor-panel.collapsed {
    width: auto;
    height: auto;
    max-height: none;
  }

  /* ── Title bar ────────────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    cursor: move;
    user-select: none;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }

  .panel-actions {
    display: flex;
    gap: 6px;
  }

  .panel-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }

  .panel-btn:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.08);
  }

  /* ── Tabs ─────────────────────────────────────────────── */

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid #1e293b;
    flex-shrink: 0;
  }

  .panel-tab {
    flex: 1;
    padding: 8px 12px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }

  .panel-tab:hover { color: #94a3b8; }

  .panel-tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  /* ── Content area ─────────────────────────────────────── */

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    min-height: 0;
  }

  .panel-content::-webkit-scrollbar {
    width: 6px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
  }

  /* ── Search / filter ──────────────────────────────────── */

  .search-input {
    width: 100%;
    padding: 7px 10px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 12px;
    outline: none;
    margin-bottom: 10px;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #3b82f6;
  }

  .search-input::placeholder {
    color: #475569;
  }

  /* ── Variable groups ──────────────────────────────────── */

  .var-group {
    margin-bottom: 16px;
  }

  .var-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    user-select: none;
  }

  .var-group-toggle {
    color: #475569;
    font-size: 10px;
    transition: transform 0.15s;
  }

  .var-group-toggle.open {
    transform: rotate(90deg);
  }

  .var-group-file {
    font-size: 11px;
    color: #64748b;
    font-family: ui-monospace, monospace;
  }

  .var-group-scope {
    font-size: 11px;
    color: #3b82f6;
    font-family: ui-monospace, monospace;
  }

  .var-group-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 16px;
  }

  /* ── Variable row ─────────────────────────────────────── */

  .var-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .var-name {
    font-size: 11px;
    color: #94a3b8;
    font-family: ui-monospace, monospace;
    min-width: 0;
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .var-control {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .var-modified {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
  }

  /* ── Color control ────────────────────────────────────── */

  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid #334155;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }

  .color-swatch input[type="color"] {
    position: absolute;
    top: -4px;
    left: -4px;
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    cursor: pointer;
    border: none;
    padding: 0;
    opacity: 0;
  }

  .color-text {
    flex: 1;
    min-width: 0;
  }

  /* ── Text input ───────────────────────────────────────── */

  .var-input {
    width: 100%;
    padding: 4px 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    outline: none;
    transition: border-color 0.15s;
  }

  .var-input:focus {
    border-color: #3b82f6;
  }

  /* ── Slider ───────────────────────────────────────────── */

  .slider-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .slider-input {
    flex: 1;
    -webkit-appearance: none;
    height: 4px;
    border-radius: 2px;
    background: #334155;
    outline: none;
  }

  .slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
  }

  .slider-number {
    width: 56px;
    padding: 3px 6px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    text-align: right;
    outline: none;
  }

  .slider-number:focus {
    border-color: #3b82f6;
  }

  .slider-unit {
    font-size: 11px;
    color: #64748b;
    min-width: 20px;
  }

  /* ── Footer / save bar ────────────────────────────────── */

  .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    background: #1e293b;
    border-top: 1px solid #334155;
    flex-shrink: 0;
  }

  .footer-info {
    font-size: 11px;
    color: #64748b;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s, color 0.15s;
  }

  .btn-primary {
    background: #3b82f6;
    color: #ffffff;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-primary:disabled {
    background: #1e3a5f;
    color: #64748b;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #334155;
  }

  .btn-secondary:hover {
    color: #e2e8f0;
    border-color: #475569;
  }

  /* ── Inspect tab ──────────────────────────────────────── */

  .inspect-prompt {
    text-align: center;
    color: #64748b;
    padding: 24px 12px;
    font-size: 12px;
  }

  .inspect-prompt kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #94a3b8;
  }

  .selected-element-info {
    padding: 8px;
    background: #1e293b;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .element-tag {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: #f472b6;
  }

  .element-classes {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #a78bfa;
    margin-top: 4px;
  }

  .rule-section {
    margin-bottom: 12px;
  }

  .rule-header {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .rule-selector {
    font-size: 12px;
    color: #3b82f6;
    font-family: ui-monospace, monospace;
    margin-bottom: 4px;
  }

  .rule-prop {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  .rule-prop-name {
    font-size: 11px;
    color: #94a3b8;
    font-family: ui-monospace, monospace;
  }

  .rule-prop-value {
    font-size: 11px;
    color: #e2e8f0;
    font-family: ui-monospace, monospace;
  }

  .rule-prop-value.overridden {
    color: #475569;
    text-decoration: line-through;
  }

  /* ── Variable chip (inline var editor) ─────────────────── */

  .var-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    color: #60a5fa;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .var-chip:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .var-chip.active {
    background: rgba(59, 130, 246, 0.25);
    border-color: #3b82f6;
    color: #93c5fd;
  }

  .var-inline-editor {
    margin-top: 6px;
    padding: 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
  }

  /* ── Expression field ──────────────────────────────────── */

  .expr-field {
    margin-top: 4px;
  }

  .expr-structured {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    padding: 6px 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
  }

  .expr-code {
    color: #64748b;
    white-space: nowrap;
    user-select: none;
    font-size: 10px;
  }

  .expr-readonly {
    color: #475569;
    font-style: italic;
    font-size: 10px;
  }

  .expr-literal {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    position: relative;
  }

  .expr-badge {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    background: rgba(59, 130, 246, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
    user-select: none;
  }

  .expr-input {
    min-width: 3ch;
    padding: 2px 4px !important;
    font-size: 11px !important;
    background: rgba(59, 130, 246, 0.08) !important;
    border-color: rgba(59, 130, 246, 0.25) !important;
    color: #93c5fd !important;
  }

  .expr-input:focus {
    background: rgba(59, 130, 246, 0.15) !important;
    border-color: #3b82f6 !important;
  }

  .expr-raw {
    margin-top: 4px;
  }

  /* ── Selection overlay ────────────────────────────────── */

  .css-editor-overlay {
    position: fixed;
    pointer-events: none;
    z-index: 99998;
    border: 2px solid #3b82f6;
    border-radius: 2px;
    transition: all 0.1s ease;
  }

  .css-editor-overlay-label {
    position: absolute;
    top: -22px;
    left: -1px;
    background: #3b82f6;
    color: #ffffff;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px 3px 0 0;
    white-space: nowrap;
    font-family: ui-monospace, monospace;
  }

  .css-editor-hover-overlay {
    position: fixed;
    pointer-events: none;
    z-index: 99997;
    border: 1px dashed #3b82f6;
    border-radius: 2px;
    background: rgba(59, 130, 246, 0.04);
  }

  /* ── Collapsed toggle button ──────────────────────────── */

  .css-editor-toggle {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 99999;
    padding: 8px 14px;
    background: #0f172a;
    color: #94a3b8;
    border: 1px solid #1e293b;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: color 0.15s, background 0.15s;
    font-family: ui-monospace, monospace;
  }

  .css-editor-toggle:hover {
    color: #e2e8f0;
    background: #1e293b;
  }

  /* ── Empty state ──────────────────────────────────────── */

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #475569;
  }

  .empty-state p {
    margin: 8px 0;
    font-size: 12px;
  }

  /* ── Text editing ─────────────────────────────────────── */

  .text-edit-input {
    width: 100%;
    padding: 6px 8px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 12px;
    outline: none;
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
    transition: border-color 0.15s;
  }

  .text-edit-input:focus {
    border-color: #3b82f6;
  }
`
