/**
 * Court first play builder UI.
 *
 * This module owns only the builder controls. The court renderer and the play
 * compiler remain authoritative elsewhere; every interaction is reported as a
 * small action so the integration layer can keep one document and one clock.
 */

const FAMILIES = [
  ['serve', 'Serve'], ['return', 'Return'], ['drive', 'Drive'], ['drop', 'Drop'],
  ['dink', 'Dink'], ['volley', 'Volley / block'], ['reset', 'Reset'],
  ['lob', 'Lob'], ['overhead', 'Overhead']
];
const PLAYERS = [['player1', 'Green 1'], ['player2', 'Green 2'], ['player3', 'Orange 1'], ['player4', 'Orange 2']];
const MAX_IMPORT_BYTES = 512 * 1024;

const text = (element, value) => { element.textContent = value == null ? '' : String(value); return element; };
const el = (tag, className, label) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) text(node, label);
  return node;
};
const button = (label, action, className = '') => {
  const node = el('button', className, label);
  node.type = 'button';
  node.dataset.action = action;
  return node;
};
const option = (value, label) => { const node = el('option', '', label); node.value = value; return node; };
const select = (label, action, values) => {
  const wrap = el('label', 'builder-field');
  text(wrap.appendChild(el('span', 'builder-field-label')), label);
  const control = el('select'); control.dataset.action = action; control.setAttribute('aria-label', label);
  values.forEach(([value, name]) => control.appendChild(option(value, name)));
  wrap.appendChild(control); return wrap;
};
const labelled = (label, control) => {
  const wrap = el('label', 'builder-field');
  wrap.appendChild(el('span', 'builder-field-label', label)); wrap.appendChild(control); return wrap;
};
const numberField = (label, action, value, min, max) => {
  const input = document.createElement('input'); input.type = 'number'; input.value = Number(value); input.min = min; input.max = max; input.step = '0.1'; input.dataset.action = action; input.setAttribute('aria-label', label);
  return labelled(label, input);
};

function shotLabel(shot, index) { return `${index + 1}. ${FAMILIES.find(([id]) => id === shot.family)?.[1] || 'Shot'}`; }

function recipeSummary(shot) {
  if (!shot) return '';
  const family = FAMILIES.find(([id]) => id === shot.family)?.[1]?.toLowerCase() || 'shot';
  const x = Number(shot.target?.x);
  const y = Number(shot.target?.y);
  const target = Number.isFinite(x) && Number.isFinite(y)
    ? (Math.abs(x - 10) < 1.1 ? (y > 30 ? 'deep centerline' : 'centerline') : x < 7 ? 'wide left' : x > 13 ? 'wide right' : 'middle')
    : 'selected target';
  const arc = shot.arc && shot.arc !== 'medium' ? ` ${shot.arc} arc` : '';
  const pace = shot.pace && shot.pace !== 'medium' ? `, ${shot.pace} pace` : '';
  return `${family}${arc}${pace} to ${target} (green-side view)`;
}

export function mountBuilderUI({ onAction = () => {} } = {}) {
  const root = el('section', 'builder-ui');
  root.setAttribute('aria-label', 'Build a Play');
  document.body.appendChild(root);
  document.body.classList.add('builder-workspace');
  let current = { document: null, selectedShotId: null, findings: [], playing: false, time: 0, duration: 8.5, view: '3d', workspace: 'builder', saveStatus: 'Saved locally', library: [], templates: [], loop: false, rate: 1, busy: false, message: '', canUndo: false, canRedo: false, camera: 'overhead' };
  let destroyed = false;
  let renderedDocument = null;
  let renderedSelectedShotId = null;
  let renderedView = null;
  let renderedWorkspace = null;
  let renderedWaypointKey = '';
  let userInspectorExpanded = null;
  let inspectorManualCollapsed = null;
  let advancedOpen = false;
  const templateDialog = el('dialog', 'builder-dialog');
  const importDialog = el('dialog', 'builder-dialog');
  templateDialog.setAttribute('aria-label', 'Play library and templates');
  importDialog.setAttribute('aria-label', 'Import or export play');
  function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  function openTemplateDialog() {
    templateDialog.replaceChildren(el('h2', '', 'Learn / Templates'), el('p', 'builder-dialog-copy', 'Choose a lesson or template to open as a copy.'));
    const list = el('div', 'builder-dialog-list'); const entries = [...(current.templates || []).map(item => ({ ...item, __kind: 'template' })), ...(current.library || []).map(item => ({ ...item, __kind: 'open' }))];
    entries.forEach(item => { const id = item.id; const label = item.name || item.title || id; const b = button(label, 'template-open', 'builder-button'); b.dataset.id = id; b.dataset.kind = item.__kind; list.appendChild(b); });
    if (!entries.length) list.appendChild(el('p', 'builder-dialog-copy', 'No saved plays or templates yet.'));
    templateDialog.appendChild(list); templateDialog.appendChild(button('Close', 'dialog-close', 'builder-button'));
    if (!templateDialog.open) templateDialog.showModal();
  }
  function openImportDialog() {
    importDialog.replaceChildren(el('h2', '', 'Import / Export'), el('p', 'builder-dialog-copy', 'Paste a versioned play JSON backup or choose a local file, then select Import JSON.'), labelled('JSON backup', Object.assign(document.createElement('textarea'), { rows: 8, spellcheck: false })));
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.setAttribute('aria-label', 'Choose JSON file'); file.dataset.action = 'import-file'; importDialog.appendChild(labelled('JSON file', file));
    const actions = el('div', 'builder-dialog-actions'); actions.append(button('Import JSON', 'import-json', 'builder-button builder-button-primary')); actions.append(button('Export current play', 'export', 'builder-button')); actions.append(button('Close', 'dialog-close', 'builder-button')); importDialog.appendChild(actions);
    if (!importDialog.open) importDialog.showModal();
  }

  const fire = (type, payload) => onAction(type, payload);
  const title = el('h1', 'builder-title', 'Build a Play');
  const status = el('span', 'builder-save-status');

  function render(state = {}) {
    if (destroyed) return;
    current = { ...current, ...state, document: state.document || current.document };
    const doc = current.document || { title: 'Build a Play', shots: [], players: {}, assistance: {} };
    const shots = Array.isArray(doc.shots) ? doc.shots : [];
    const selected = shots.find(shot => shot.id === current.selectedShotId) || shots[0];
    if (selected) current.selectedShotId = selected.id;
    const waypointKey = JSON.stringify(current.waypointPolicy || null);
    const structureChanged = renderedDocument !== doc || renderedSelectedShotId !== current.selectedShotId || renderedView !== current.view || renderedWorkspace !== current.workspace || renderedWaypointKey !== waypointKey;
    if (!structureChanged && root.childElementCount) {
      const range = root.querySelector('input[data-action="seek"]');
      if (range && document.activeElement !== range) range.value = String(current.time || 0);
      const save = root.querySelector('.builder-save-status'); if (save) save.textContent = current.saveStatus || 'Draft';
      const message = root.querySelector('.builder-message'); if (message) message.textContent = current.message || '';
      const cueNode = root.querySelector('.builder-cue'); const fastCue = current.cue; if (cueNode && fastCue) { cueNode.querySelector('strong').textContent = fastCue.title || 'Current shot'; cueNode.querySelector('span').textContent = (/target|coordinate|\d+\.\d/i.test(fastCue.description || '') && selected) ? recipeSummary(selected) : (fastCue.description || (selected ? recipeSummary(selected) : '')); }
      const play = root.querySelector('[data-action="play-pause"]'); if (play) { play.textContent = current.playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(Boolean(current.playing))); }
      root.classList.toggle('builder-busy', Boolean(current.busy));
      const loop = root.querySelector('[data-action="loop"]'); if (loop) { loop.textContent = current.loop ? 'Loop on' : 'Loop'; loop.setAttribute('aria-pressed', String(Boolean(current.loop))); }
      const inspector = root.querySelector('.builder-inspector'); const collapsed = Boolean(inspectorManualCollapsed ?? true); if (inspector) inspector.classList.toggle('builder-inspector-collapsed', collapsed); const collapseButton = root.querySelector('[data-action="collapse-inspector"]'); if (collapseButton) { collapseButton.textContent = collapsed ? 'Edit shot' : 'Collapse'; collapseButton.setAttribute('aria-expanded', String(!collapsed)); }
      root.appendChild(templateDialog); root.appendChild(importDialog);
      return;
    }
    renderedDocument = doc; renderedSelectedShotId = current.selectedShotId; renderedView = current.view; renderedWorkspace = current.workspace; renderedWaypointKey = waypointKey;
    const previousAdvanced = root.querySelector('.builder-advanced'); if (previousAdvanced) advancedOpen = previousAdvanced.open;
    root.replaceChildren();
    root.classList.toggle('builder-planner', current.workspace === 'planner');

    const top = el('header', 'builder-topbar');
    const brand = el('div', 'builder-brand');
    text(title, 'Pickleball Park'); brand.appendChild(title);
    top.appendChild(brand);
    const titleField = el('label', 'builder-title-field'); titleField.append(el('span', 'sr-only', 'Play title'));
    const titleInput = el('input'); titleInput.type = 'text'; titleInput.value = doc.title || 'Untitled play'; titleInput.maxLength = 80; titleInput.dataset.action = 'title'; titleInput.setAttribute('aria-label', 'Play title'); titleField.append(titleInput);
    top.appendChild(titleField);
    const topActions = el('div', 'builder-top-actions');
    const playsMenu = el('details', 'builder-menu'); playsMenu.append(el('summary', '', 'Plays'));
    playsMenu.append(button('New Play', 'new', 'builder-menu-item builder-button builder-button-primary'), button('Learn', 'templates', 'builder-menu-item builder-button'), button(current.workspace === 'planner' ? 'Return to builder' : 'Planner', current.workspace === 'planner' ? 'workspace-builder' : 'workspace-planner', 'builder-menu-item builder-button'), button('Help', 'help', 'builder-menu-item builder-button'));
    const fileMenu = el('details', 'builder-menu'); fileMenu.append(el('summary', '', 'File'));
    fileMenu.append(button('Open', 'open', 'builder-menu-item builder-button'), button('Save As', 'save-as', 'builder-menu-item builder-button'), button('Import / Export', 'import-export', 'builder-menu-item builder-button'));
    topActions.append(playsMenu, fileMenu);
    status.textContent = current.saveStatus || 'Draft'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); topActions.appendChild(status);
    top.appendChild(topActions); root.appendChild(top);

    const meta = el('div', 'builder-meta');
    meta.appendChild(el('span', 'builder-message', current.message || ''));
    const cue = current.cue || (selected ? { title: shotLabel(selected, shots.indexOf(selected)), description: '' } : null);
    if (cue) { const cueNode = el('div', 'builder-cue'); const cueText = cue.description && !/target|coordinate|\d+\.\d/i.test(cue.description) ? cue.description : (selected ? recipeSummary(selected) : ''); cueNode.append(el('strong', '', cue.title || 'Current shot'), el('span', '', cueText)); meta.appendChild(cueNode); }
    if (current.waypointPolicy?.requiresConfirmation) {
      const affected = (current.waypointPolicy.affected || []).map(item => `${item.number ? `Shot ${item.number}` : item.shotId || 'Shot'}${item.player ? ` · ${item.player}` : ''}`).join(', ');
      const detail = [current.waypointPolicy.message || 'Some movement waypoints are preview-only.', affected ? `Affected: ${affected}` : ''].filter(Boolean).join(' ');
      const notice = el('div', 'builder-waypoint-notice'); notice.append(el('strong', '', 'Preview permission needed'), el('span', '', detail), button('Preview destination only', 'acknowledge-waypoints', 'builder-button builder-button-accent')); meta.appendChild(notice);
    }
    root.appendChild(meta);

    const strip = el('nav', 'builder-shot-strip'); strip.setAttribute('aria-label', 'Rally sequence');
    const stripLabel = el('span', 'builder-strip-label', 'Rally sequence'); strip.appendChild(stripLabel);
    shots.forEach((shot, index) => { const b = button(shotLabel(shot, index), 'select-shot', `builder-shot ${shot.id === current.selectedShotId ? 'is-selected' : ''}`); b.dataset.shotId = shot.id; b.setAttribute('aria-current', shot.id === current.selectedShotId ? 'step' : 'false'); strip.appendChild(b); });
    const add = button('+ Add shot', 'add-shot', 'builder-button builder-add-shot'); strip.appendChild(add);

    const assistanceBar = el('div', 'builder-assistance-bar'); assistanceBar.append(el('strong', '', 'Assistance'));
    [['autoShading', 'Auto Shading', 'Shading changes eligible movement'], ['showGuides', 'Coverage Guides', 'Explain suggested positions only']].forEach(([field, label, description]) => { const row = el('label', 'builder-switch'); const input = el('input'); input.type = 'checkbox'; input.checked = Boolean(doc.assistance?.[field]); input.dataset.assistance = field; input.setAttribute('aria-label', label); row.append(input, el('span', '', label), el('span', 'sr-only', description)); assistanceBar.append(row); });
    strip.appendChild(assistanceBar); root.appendChild(strip);

    const layout = el('div', 'builder-layout');
    const court = el('div', 'builder-court-region'); court.dataset.view = current.view; court.setAttribute('aria-label', `${current.view === '3d' ? '3D' : '2D'} rally court host region`);
    court.setAttribute('data-builder-court-region', 'true');
    const viewToggle = el('div', 'builder-view-toggle'); viewToggle.setAttribute('role', 'group'); viewToggle.setAttribute('aria-label', 'Court view');
    ['3d', '2d'].forEach(view => { const b = button(view.toUpperCase(), 'view', `builder-view-button ${current.view === view ? 'is-selected' : ''}`); b.dataset.view = view; b.setAttribute('aria-pressed', String(current.view === view)); viewToggle.appendChild(b); }); court.appendChild(viewToggle); layout.appendChild(court);
    if (current.view === '3d') {
      const camera = select('Camera', 'camera', [['overhead', 'Overhead 3D'], ['sideline', 'Sideline'], ['behind-green', 'Behind Green'], ['behind-orange', 'Behind Orange']]);
      camera.className = 'builder-camera'; camera.querySelector('select').value = current.camera || 'overhead'; court.appendChild(camera);
    }

    const inspectorAutoCollapsed = current.workspace === 'planner' ? false : (inspectorManualCollapsed ?? true);
    const inspector = el('aside', `builder-inspector ${inspectorAutoCollapsed ? 'builder-inspector-collapsed' : ''}`); inspector.setAttribute('aria-label', 'Selected shot settings');
    if (current.workspace === 'planner') {
      inspector.append(el('h2', '', 'Court Planner')); inspector.append(el('p', 'builder-selected-summary', 'Your planner layout is preserved. Use it as the starting layout for a new or selected play.'));
      inspector.append(button('Return to builder', 'workspace-builder', 'builder-button builder-button-primary'));
      inspector.append(button('Use as starting layout', 'use-planner', 'builder-button builder-button-accent'));
      inspector.append(el('p', 'builder-selected-summary', 'Planner arrows and markup stay in the planner. They are not interpreted as rally shots.'));
    } else if (selected) {
      const inspectorHeader = el('div', 'builder-inspector-header'); inspectorHeader.append(el('div', '', selected ? `Shot ${shots.indexOf(selected) + 1}` : 'No shot selected')); const collapse = button(inspectorAutoCollapsed ? 'Edit shot' : 'Collapse', 'collapse-inspector', 'builder-button builder-collapse'); collapse.setAttribute('aria-expanded', String(!inspectorAutoCollapsed)); inspectorHeader.append(collapse); inspector.appendChild(inspectorHeader);
      const summary = el('p', 'builder-selected-summary', recipeSummary(selected)); inspector.appendChild(summary);
      const familySelect = select('Shot family', 'edit-family', FAMILIES); familySelect.querySelector('select').value = selected.family; inspector.appendChild(familySelect);
      const hitterSelect = select('Hitter', 'edit-hitter', PLAYERS); hitterSelect.querySelector('select').value = selected.hitter; inspector.appendChild(hitterSelect);
      const targetRow = el('div', 'builder-target-row'); targetRow.append(el('div', 'builder-target-readout', `Target ${Number(selected.target?.x || 0).toFixed(1)}, ${Number(selected.target?.y || 0).toFixed(1)}`)); targetRow.append(button('Place target on court', 'place-target', 'builder-button builder-button-accent')); inspector.appendChild(targetRow);
      const details = el('details', 'builder-shot-details'); details.append(el('summary', '', 'Details · coordinates, contact, movement'));
      const coords = el('div', 'builder-grid-fields'); coords.appendChild(numberField('Target width', 'edit-target.x', selected.target?.x ?? 10, 0, 20)); coords.appendChild(numberField('Target depth', 'edit-target.y', selected.target?.y ?? 20, 0, 44)); details.appendChild(coords);
      const presets = el('div', 'builder-presets'); presets.append(el('span', 'builder-field-label', 'Target presets · green side')); [['wide', 3], ['middle', 10], ['centerline', 10]].forEach(([label, x]) => { const b = button(label, 'target-preset', 'builder-chip'); b.dataset.x = x; b.dataset.y = selected.target?.y || 20; b.dataset.direction = label; presets.appendChild(b); }); details.appendChild(presets);
      const tuning = el('div', 'builder-grid-fields'); const arc = select('Arc', 'edit-arc', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]); const pace = select('Pace', 'edit-pace', [['soft', 'Soft'], ['medium', 'Medium'], ['firm', 'Firm']]); arc.querySelector('select').value = selected.arc || 'medium'; pace.querySelector('select').value = selected.pace || 'medium'; tuning.append(arc, pace); inspector.appendChild(tuning);
      details.append(select('Receiver', 'edit-receiver', [['auto', 'Automatic'], ...PLAYERS])); details.querySelector('[data-action="edit-receiver"]').value = selected.receiver || 'auto';
      details.append(select('Contact style', 'edit-contactStyle', [['auto', 'Automatic'], ['forehand', 'Forehand'], ['backhand', 'Backhand'], ['short-hop', 'Short hop']])); details.querySelector('[data-action="edit-contactStyle"]').value = selected.contactStyle || 'auto';
      if (selected.family === 'serve') { details.append(select('Serve method', 'edit-serveMethod', [['drop', 'Drop serve'], ['volley', 'Volley serve']])); details.querySelector('[data-action="edit-serveMethod"]').value = selected.serveMethod || 'drop'; }
      const movement = select('Movement intent', 'edit-movement.intent', [['hold', 'Hold'], ['advance', 'Advance'], ['recover', 'Recover'], ['manual', 'Manual']]); movement.querySelector('select').value = selected.movement?.intent || 'recover'; inspector.appendChild(movement);
      const manual = el('div', 'builder-grid-fields'); manual.appendChild(numberField('Manual X', 'edit-movement.target.x', selected.movement?.target?.x ?? 10, 0, 20)); manual.appendChild(numberField('Manual Y', 'edit-movement.target.y', selected.movement?.target?.y ?? 20, -8, 52)); details.appendChild(manual);
      const pinned = el('label', 'builder-switch'); const pin = el('input'); pin.type = 'checkbox'; pin.checked = Boolean(selected.movement?.pinned); pin.dataset.action = 'edit-movement.pinned'; pinned.append(pin, el('span', '', 'Pin movement target')); details.appendChild(pinned); inspector.appendChild(details);
      const actions = el('div', 'builder-shot-actions'); actions.append(button('Duplicate', 'duplicate-shot', 'builder-button')); actions.append(button('Delete', 'delete-shot', 'builder-button builder-button-danger')); actions.append(button('Move earlier', 'move-earlier', 'builder-button')); actions.append(button('Move later', 'move-later', 'builder-button')); inspector.appendChild(actions);
      const advanced = el('details', 'builder-advanced'); advanced.open = advancedOpen; advanced.append(el('summary', '', 'Rally details'));
      const opening = select('Starting condition', 'opening', [['serve', 'Opening serve'], ['midrally', 'Mid-rally']]); opening.querySelector('select').value = doc.opening || 'serve'; advanced.append(opening);
      const ending = select('Ending intent', 'ending', [['stop', 'Stop at authored end'], ['winner', 'Declared winner'], ['fault', 'Declared fault']]); ending.querySelector('select').value = doc.ending || 'stop'; advanced.append(ending);
      const fault = el('label', 'builder-switch'); const faultInput = el('input'); faultInput.type = 'checkbox'; faultInput.checked = Boolean(doc.intentionalFault); faultInput.dataset.action = 'intentionalFault'; fault.append(faultInput, el('span', '', 'Intentional coaching mistake'), el('small', '', 'Keep the rule warning visible at the terminal fault.')); advanced.append(fault);
      const scope = select('Shade team', 'shade-team', [['both', 'Both teams'], ['green', 'Green'], ['orange', 'Orange']]); scope.querySelector('select').value = doc.assistance?.team || 'both'; advanced.append(scope); inspector.appendChild(advanced);
      const handed = el('details', 'builder-handedness'); handed.open = false; handed.append(el('summary', '', 'Player handedness')); PLAYERS.forEach(([id, name]) => { const value = doc.players?.[id]?.handedness || 'right'; const field = select(name, 'handedness', [['right', 'Right-handed'], ['left', 'Left-handed']]); const control = field.querySelector('select'); control.value = value; control.dataset.playerId = id; handed.append(field); }); inspector.appendChild(handed);
      if (current.findings?.length) { const find = el('div', 'builder-findings'); find.append(el('strong', '', 'Review')); current.findings.forEach(f => { const item = typeof f === 'string' ? { message: f } : f; const label = [item.shotId || item.stepId, item.kind].filter(Boolean).join(' · '); find.append(el('p', '', `${label ? `${label}: ` : ''}${item.message || 'Review this shot'}`)); }); inspector.appendChild(find); }
    } else {
      const header=el('div','builder-inspector-header');header.append(el('span','','Play settings'),button(inspectorAutoCollapsed?'Edit play':'Collapse','collapse-inspector','builder-button builder-collapse'));inspector.append(header,el('p','builder-empty','Add a shot to start authoring.'));
      const global = el('div', 'builder-global-settings'); global.append(el('h2', '', 'Play settings')); [['autoShading', 'Auto Shading'], ['showGuides', 'Show Coverage Guides']].forEach(([field, label]) => { const row = el('label', 'builder-switch'); const input = el('input'); input.type = 'checkbox'; input.checked = Boolean(doc.assistance?.[field]); input.dataset.assistance = field; row.append(input, el('span', '', label)); global.append(row); }); global.append(select('Starting condition', 'opening', [['serve', 'Opening serve'], ['midrally', 'Mid-rally']])); global.append(select('Ending intent', 'ending', [['stop', 'Stop at authored end'], ['winner', 'Declared winner'], ['fault', 'Declared fault']])); inspector.append(global);
    }
    layout.appendChild(inspector); root.appendChild(layout);

    const transport = el('footer', 'builder-transport');
    const transportButtons = el('div', 'builder-transport-buttons');
    const undo = button('↶', 'undo', 'builder-button builder-icon-button'); undo.setAttribute('aria-label', 'Undo authored edit'); undo.disabled = !current.canUndo; const redo = button('↷', 'redo', 'builder-button builder-icon-button'); redo.setAttribute('aria-label', 'Redo authored edit'); redo.disabled = !current.canRedo;  transportButtons.append(button('Previous', 'previous', 'builder-button')); const play = button(current.playing ? 'Pause' : 'Play', 'play-pause', 'builder-button builder-button-primary'); play.setAttribute('aria-pressed', String(Boolean(current.playing))); transportButtons.append(play); transportButtons.append(button('Next', 'next', 'builder-button')); transportButtons.append(button('Restart', 'restart', 'builder-button'));
    const range = el('input'); range.type = 'range'; range.min = 0; range.max = current.duration || 1; range.step = .01; range.value = current.time || 0; range.dataset.action = 'seek'; range.setAttribute('aria-label', 'Playhead'); transportButtons.append(range);
    const loop = button(current.loop ? 'Loop on' : 'Loop', 'loop', 'builder-button'); loop.setAttribute('aria-pressed', String(Boolean(current.loop))); transportButtons.append(loop); const rate = select('Speed', 'rate', [['0.25', '0.25×'], ['0.5', '0.5×'], ['1', '1×']]); rate.querySelector('select').value = String(current.rate || 1); transportButtons.append(rate); transport.appendChild(transportButtons);
    const secondary = el('div', 'builder-secondary-actions'); secondary.append(undo,redo); transport.appendChild(secondary); root.appendChild(transport);
    root.append(templateDialog, importDialog);
  }
  function rerenderAction(type, payload) { fire(type, payload); }
  function handleClick(event) {
    const target = event.target.closest('[data-action]'); if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    const menu = target.closest('.builder-menu'); if (menu) menu.open = false;
    const input=document.activeElement;if(input&&root.contains(input)&&input.matches('input:not([type=range]),textarea'))input.blur();
    if (action === 'select-shot') { inspectorManualCollapsed = false; userInspectorExpanded = true; rerenderAction('selectShot', target.dataset.shotId); }
    else if (action === 'view') rerenderAction('view', target.dataset.view);
    else if (action === 'workspace-planner') rerenderAction('workspace', 'planner');
    else if (action === 'workspace-builder') rerenderAction('workspace', 'builder');
    else if (action === 'add-shot') rerenderAction('addShot');
    else if (action === 'new') rerenderAction('new');
    else if (action === 'templates') openTemplateDialog();
    else if (action === 'template-open') { closeDialog(templateDialog); rerenderAction(target.dataset.kind === 'open' ? 'open' : 'template', target.dataset.id); }
    else if (action === 'dialog-close') { closeDialog(templateDialog); closeDialog(importDialog); }
    else if (action === 'place-target') { inspectorManualCollapsed = true; userInspectorExpanded = null; rerenderAction('placeTarget', { shotId: current.selectedShotId }); }
    else if (action === 'target-preset') rerenderAction('editShot', { field: 'target', value: { x: Number(target.dataset.x), y: Number(target.dataset.y) } });
    else if (action === 'duplicate-shot') rerenderAction('duplicateShot', current.selectedShotId);
    else if (action === 'delete-shot') rerenderAction('deleteShot', current.selectedShotId);
    else if (action === 'move-earlier') rerenderAction('moveShot', { id: current.selectedShotId, delta: -1 });
    else if (action === 'move-later') rerenderAction('moveShot', { id: current.selectedShotId, delta: 1 });
    else if (action === 'collapse-inspector') { const inspector = root.querySelector('.builder-inspector'); inspectorManualCollapsed = !(inspector?.classList.contains('builder-inspector-collapsed')); userInspectorExpanded = !inspectorManualCollapsed; render({}); }
    else if (action === 'play-pause') { inspectorManualCollapsed = true; userInspectorExpanded = null; rerenderAction('playPause'); }
    else if (action === 'restart' || action === 'previous' || action === 'next' || action === 'undo' || action === 'redo' || action === 'save-as' || action === 'use-planner') rerenderAction(({ 'save-as': 'saveAs', 'use-planner': 'usePlanner' }[action] || action));
    else if (action === 'open') openTemplateDialog();
    else if (action === 'import-export') openImportDialog();
    else if (action === 'import-json') { const area = importDialog.querySelector('textarea'); closeDialog(importDialog); rerenderAction('import', area?.value || ''); }
    else if (action === 'export') rerenderAction('export');
    else if (action === 'loop') rerenderAction('loop', !current.loop);
    else if (action === 'help') rerenderAction('help');
    else if (action === 'acknowledge-waypoints') rerenderAction('acknowledgeWaypoints');
  }
  function handleChange(event) {
    const target = event.target; if (!target.dataset.action && !target.dataset.assistance) return;
    if (target.dataset.assistance) fire('assistance', { field: target.dataset.assistance, value: target.checked });
    else if (target.dataset.action === 'title') fire('title', target.value);
    else if (target.dataset.action.startsWith('edit-')) fire('editShot', { field: target.dataset.action.slice(5), value: target.type === 'checkbox' ? target.checked : (target.type === 'number' ? Number(target.value) : target.value) });
    else if (target.dataset.action === 'shade-team') fire('assistance',{field:'team',value:target.value});
    else if (target.dataset.action === 'rate') fire('rate', Number(target.value));
    else if (target.dataset.action === 'camera') fire('camera', target.value);
    else if (target.dataset.action === 'handedness') fire('handedness', { id: target.dataset.playerId, value: target.value });
    else if (target.dataset.action === 'import-file') {
      const file = target.files?.[0]; if (file) { if (file.size > MAX_IMPORT_BYTES) { fire('message', `Import is limited to ${Math.round(MAX_IMPORT_BYTES / 1024)} KiB.`); return; } file.text().then(raw => { if (!importDialog.open) return; const area=importDialog.querySelector('textarea'); if(area)area.value=raw; }).catch(() => fire('message','The selected file could not be read. Try another JSON backup.'));  }
    }
    else if (target.dataset.action === 'opening' || target.dataset.action === 'ending') fire(target.dataset.action, target.value);
    else if (target.dataset.action === 'intentionalFault') fire('intentionalFault', target.checked);
    else if (target.dataset.action === 'seek') fire('seek', Number(target.value));
  }
  function handleInput(event) { if (event.target.dataset.action === 'seek') fire('seek', Number(event.target.value)); }
  root.addEventListener('pointerdown',event=>{if(event.target.closest('button')&&root.contains(document.activeElement)&&document.activeElement.matches('input:not([type=range]),textarea'))event.preventDefault();});
  root.addEventListener('keydown', event => { if (event.key !== 'Escape') return; const menu = event.target.closest('.builder-menu[open]'); if (menu) { menu.open = false; menu.querySelector('summary')?.focus(); event.preventDefault(); } });
  root.addEventListener('click', handleClick); root.addEventListener('change', handleChange); root.addEventListener('input', handleInput);
  render();
  return { render, destroy() { destroyed = true; root.remove(); document.body.classList.remove('builder-workspace', 'planner-workspace'); }, element: root };
}

export { FAMILIES };
