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

export function defaultBuilderDocument() {
  const shot = (id, family, hitter, target, overrides = {}) => ({
    id, family, hitter, receiver: 'auto', contactStyle: 'auto', target, arc: 'medium', pace: 'medium',
    movement: { intent: 'recover', pinned: false }, serveMethod: 'drop', ...overrides
  });
  return {
    id: 'starter-play', title: 'Build a Play', schemaVersion: 1,
    initialLayout: { player1: { x: 5, y: -1 }, player2: { x: 15, y: 14 }, player3: { x: 5, y: 45 }, player4: { x: 15, y: 45 } },
    players: { player1: { team: 'green', handedness: 'right' }, player2: { team: 'green', handedness: 'right' }, player3: { team: 'orange', handedness: 'right' }, player4: { team: 'orange', handedness: 'right' } },
    shots: [
      shot('shot-serve', 'serve', 'player3', { x: 13, y: 8 }, { arc: 'high', pace: 'soft' }),
      shot('shot-return', 'return', 'player1', { x: 7, y: 35 }, { pace: 'firm' }),
      shot('shot-third', 'drop', 'player3', { x: 13, y: 17 }, { movement: { intent: 'advance', pinned: false } })
    ],
    assistance: { autoShading: false, showGuides: false, team: 'both' }, opening: 'serve', ending: 'stop', intentionalFault: false
  };
}

function shotLabel(shot, index) { return `${index + 1}. ${FAMILIES.find(([id]) => id === shot.family)?.[1] || 'Shot'}`; }

export function mountBuilderUI({ onAction = () => {} } = {}) {
  const root = el('section', 'builder-ui');
  root.setAttribute('aria-label', 'Build a Play');
  document.body.appendChild(root);
  document.body.classList.add('builder-workspace');
  let current = { document: defaultBuilderDocument(), selectedShotId: 'shot-serve', findings: [], playing: false, time: 0, duration: 8.5, view: '3d', workspace: 'builder', saveStatus: 'Saved locally', library: [], templates: [], loop: false, rate: 1, busy: false, message: '' };
  let destroyed = false;
  let renderedDocument = null;
  let renderedSelectedShotId = null;
  let renderedView = null;
  let renderedWorkspace = null;

  const fire = (type, payload) => onAction(type, payload);
  const title = el('h1', 'builder-title', 'Build a Play');
  const status = el('span', 'builder-save-status');

  function render(state = {}) {
    if (destroyed) return;
    current = { ...current, ...state, document: state.document || current.document };
    const doc = current.document || defaultBuilderDocument();
    const shots = Array.isArray(doc.shots) ? doc.shots : [];
    const selected = shots.find(shot => shot.id === current.selectedShotId) || shots[0];
    if (selected) current.selectedShotId = selected.id;
    const structureChanged = renderedDocument !== doc || renderedSelectedShotId !== current.selectedShotId || renderedView !== current.view || renderedWorkspace !== current.workspace;
    if (!structureChanged && root.childElementCount) {
      const range = root.querySelector('input[data-action="seek"]');
      if (range && document.activeElement !== range) range.value = String(current.time || 0);
      const save = root.querySelector('.builder-save-status'); if (save) save.textContent = current.saveStatus || 'Draft';
      const play = root.querySelector('[data-action="play-pause"]'); if (play) play.textContent = current.playing ? 'Pause' : 'Play';
      root.classList.toggle('builder-busy', Boolean(current.busy));
      return;
    }
    renderedDocument = doc; renderedSelectedShotId = current.selectedShotId; renderedView = current.view; renderedWorkspace = current.workspace;
    root.replaceChildren();
    root.classList.toggle('builder-planner', current.workspace === 'planner');

    const top = el('header', 'builder-topbar');
    const brand = el('div', 'builder-brand');
    brand.appendChild(title); brand.appendChild(el('span', 'builder-kicker', 'Court first rally authoring'));
    top.appendChild(brand);
    const topActions = el('div', 'builder-top-actions');
    topActions.append(button('New Play', 'new', 'builder-button builder-button-primary'));
    topActions.append(button('Learn / Templates', 'templates', 'builder-button'));
    topActions.append(button(current.workspace === 'planner' ? 'Return to builder' : 'Court Planner', current.workspace === 'planner' ? 'workspace-builder' : 'workspace-planner', 'builder-button'));
    topActions.append(button('Help', 'help', 'builder-button'));
    top.appendChild(topActions); root.appendChild(top);

    const meta = el('div', 'builder-meta');
    const titleInput = el('input'); titleInput.type = 'text'; titleInput.value = doc.title || 'Untitled play'; titleInput.maxLength = 80; titleInput.dataset.action = 'title'; titleInput.setAttribute('aria-label', 'Play title');
    meta.appendChild(labelled('Play name', titleInput));
    status.textContent = current.saveStatus || 'Draft'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); meta.appendChild(status);
    if (current.message) meta.appendChild(el('span', 'builder-message', current.message));
    root.appendChild(meta);

    const strip = el('nav', 'builder-shot-strip'); strip.setAttribute('aria-label', 'Rally sequence');
    const stripLabel = el('span', 'builder-strip-label', 'Rally sequence'); strip.appendChild(stripLabel);
    shots.forEach((shot, index) => { const b = button(shotLabel(shot, index), 'select-shot', `builder-shot ${shot.id === current.selectedShotId ? 'is-selected' : ''}`); b.dataset.shotId = shot.id; b.setAttribute('aria-current', shot.id === current.selectedShotId ? 'step' : 'false'); strip.appendChild(b); });
    const add = button('+ Add shot', 'add-shot', 'builder-button builder-add-shot'); strip.appendChild(add); root.appendChild(strip);

    const layout = el('div', 'builder-layout');
    const court = el('div', 'builder-court-region'); court.dataset.view = current.view; court.setAttribute('aria-label', `${current.view === '3d' ? '3D' : '2D'} rally court; target placement is available from the selected shot panel`);
    const courtHint = el('div', 'builder-court-hint'); courtHint.append(el('strong', '', current.view === '3d' ? '3D court' : '2D court'), el('span', '', current.busy ? 'Preparing the same play…' : 'Select a shot, then place its target'));
    court.appendChild(courtHint);
    const courtSurface = el('div', 'builder-court-surface'); courtSurface.setAttribute('role', 'img'); courtSurface.setAttribute('aria-label', 'Pickleball court');
    const net = el('div', 'builder-net', 'NET'); courtSurface.appendChild(net);
    ['green-one', 'green-two', 'orange-one', 'orange-two'].forEach((name, i) => { const actor = el('span', `builder-actor builder-actor-${name}`, i < 2 ? 'G' : 'O'); actor.setAttribute('aria-hidden', 'true'); courtSurface.appendChild(actor); });
    const ball = el('span', 'builder-ball', '●'); courtSurface.appendChild(ball);
    if (selected) { const target = el('span', 'builder-target-marker'); target.title = `Target ${selected.target?.x ?? 0}, ${selected.target?.y ?? 0}`; target.setAttribute('aria-label', 'Selected shot target'); courtSurface.appendChild(target); }
    court.appendChild(courtSurface);
    const viewToggle = el('div', 'builder-view-toggle'); viewToggle.setAttribute('role', 'group'); viewToggle.setAttribute('aria-label', 'Court view');
    ['3d', '2d'].forEach(view => { const b = button(view.toUpperCase(), 'view', `builder-view-button ${current.view === view ? 'is-selected' : ''}`); b.dataset.view = view; b.setAttribute('aria-pressed', String(current.view === view)); viewToggle.appendChild(b); }); court.appendChild(viewToggle); layout.appendChild(court);
    if (current.view === '3d') {
      const camera = select('Camera', 'camera', [['overhead', 'Overhead 3D'], ['sideline', 'Sideline'], ['behind-green', 'Behind Green'], ['behind-orange', 'Behind Orange']]);
      camera.className = 'builder-camera'; camera.querySelector('select').value = current.camera || 'overhead'; court.appendChild(camera);
    }

    const inspector = el('aside', 'builder-inspector'); inspector.setAttribute('aria-label', 'Selected shot settings');
    if (current.workspace === 'planner') {
      inspector.append(el('h2', '', 'Court Planner')); inspector.append(el('p', 'builder-selected-summary', 'Your planner layout is preserved. Use it as the starting layout for a new or selected play.'));
      inspector.append(button('Return to builder', 'workspace-builder', 'builder-button builder-button-primary'));
      inspector.append(button('Use as starting layout', 'use-planner', 'builder-button builder-button-accent'));
      inspector.append(el('p', 'builder-selected-summary', 'Planner arrows and markup stay in the planner. They are not interpreted as rally shots.'));
    } else if (selected) {
      const inspectorHeader = el('div', 'builder-inspector-header'); inspectorHeader.append(el('div', '', selected ? `Shot ${shots.indexOf(selected) + 1}` : 'No shot selected')); inspectorHeader.append(button('Collapse', 'collapse-inspector', 'builder-button builder-collapse')); inspector.appendChild(inspectorHeader);
      const summary = el('p', 'builder-selected-summary', 'Choose a hitter, shot family, target, and movement. The compiler will explain limits.'); inspector.appendChild(summary);
      const familySelect = select('Shot family', 'edit-family', FAMILIES); familySelect.querySelector('select').value = selected.family; inspector.appendChild(familySelect);
      const hitterSelect = select('Hitter', 'edit-hitter', PLAYERS); hitterSelect.querySelector('select').value = selected.hitter; inspector.appendChild(hitterSelect);
      const targetRow = el('div', 'builder-target-row'); targetRow.append(el('div', 'builder-target-readout', `Target ${Number(selected.target?.x || 0).toFixed(1)}, ${Number(selected.target?.y || 0).toFixed(1)}`)); targetRow.append(button('Place target on court', 'place-target', 'builder-button builder-button-accent')); inspector.appendChild(targetRow);
      const presets = el('div', 'builder-presets'); presets.append(el('span', 'builder-field-label', 'Target presets')); [['wide', 3], ['middle', 10], ['centerline', 17]].forEach(([label, x]) => { const b = button(label, 'target-preset', 'builder-chip'); b.dataset.x = x; b.dataset.y = selected.target?.y || 20; presets.appendChild(b); }); inspector.appendChild(presets);
      const tuning = el('div', 'builder-grid-fields'); tuning.appendChild(select('Arc', 'edit-arc', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]).querySelector('select')); tuning.appendChild(select('Pace', 'edit-pace', [['soft', 'Soft'], ['medium', 'Medium'], ['firm', 'Firm']]).querySelector('select')); tuning.querySelectorAll('select')[0].value = selected.arc || 'medium'; tuning.querySelectorAll('select')[1].value = selected.pace || 'medium'; inspector.appendChild(tuning);
      const movement = select('Movement intent', 'edit-movement.intent', [['hold', 'Hold'], ['advance', 'Advance'], ['recover', 'Recover'], ['manual', 'Manual']]); movement.querySelector('select').value = selected.movement?.intent || 'recover'; inspector.appendChild(movement);
      const actions = el('div', 'builder-shot-actions'); actions.append(button('Duplicate', 'duplicate-shot', 'builder-button')); actions.append(button('Delete', 'delete-shot', 'builder-button builder-button-danger')); actions.append(button('Move earlier', 'move-earlier', 'builder-button')); actions.append(button('Move later', 'move-later', 'builder-button')); inspector.appendChild(actions);
      const assistance = el('div', 'builder-assistance'); assistance.append(el('h2', '', 'Coaching assistance'));
      [['autoShading', 'Auto Shading', 'Adjust eligible generated movement'], ['showGuides', 'Show Coverage Guides', 'Explain suggested positions only']].forEach(([field, label, description]) => { const row = el('label', 'builder-switch'); const input = el('input'); input.type = 'checkbox'; input.checked = Boolean(doc.assistance?.[field]); input.dataset.assistance = field; row.append(input, el('span', '', label), el('small', '', description)); assistance.append(row); }); inspector.appendChild(assistance);
      const advanced = el('div', 'builder-advanced'); advanced.append(el('h2', '', 'Rally details'));
      const opening = select('Starting condition', 'opening', [['serve', 'Opening serve'], ['midrally', 'Mid-rally']]); opening.querySelector('select').value = doc.opening || 'serve'; advanced.append(opening);
      const ending = select('Ending intent', 'ending', [['stop', 'Stop at authored end'], ['winner', 'Declared winner'], ['fault', 'Declared fault']]); ending.querySelector('select').value = doc.ending || 'stop'; advanced.append(ending);
      const fault = el('label', 'builder-switch'); const faultInput = el('input'); faultInput.type = 'checkbox'; faultInput.checked = Boolean(doc.intentionalFault); faultInput.dataset.action = 'intentionalFault'; fault.append(faultInput, el('span', '', 'Intentional coaching mistake'), el('small', '', 'Keep the rule warning visible at the terminal fault.')); advanced.append(fault); inspector.appendChild(advanced);
      if (current.findings?.length) { const find = el('div', 'builder-findings'); find.append(el('strong', '', 'Review')); current.findings.slice(0, 3).forEach(f => find.append(el('p', '', typeof f === 'string' ? f : f.message || 'Review this shot'))); inspector.appendChild(find); }
    } else inspector.appendChild(el('p', 'builder-empty', 'Add a shot to start authoring.'));
    layout.appendChild(inspector); root.appendChild(layout);

    const transport = el('footer', 'builder-transport');
    const transportButtons = el('div', 'builder-transport-buttons');
    transportButtons.append(button('↶', 'undo', 'builder-button builder-icon-button')); transportButtons.append(button('↷', 'redo', 'builder-button builder-icon-button')); transportButtons.append(button('Previous', 'previous', 'builder-button')); transportButtons.append(button(current.playing ? 'Pause' : 'Play', 'play-pause', 'builder-button builder-button-primary')); transportButtons.append(button('Next', 'next', 'builder-button')); transportButtons.append(button('Restart', 'restart', 'builder-button'));
    const range = el('input'); range.type = 'range'; range.min = 0; range.max = current.duration || 1; range.step = .01; range.value = current.time || 0; range.dataset.action = 'seek'; range.setAttribute('aria-label', 'Playhead'); transportButtons.append(range);
    transportButtons.append(button(current.loop ? 'Loop on' : 'Loop', 'loop', 'builder-button')); const rate = select('Speed', 'rate', [['0.5', '0.5×'], ['1', '1×'], ['1.5', '1.5×']]); rate.querySelector('select').value = String(current.rate || 1); transportButtons.append(rate); transport.appendChild(transportButtons);
    const secondary = el('div', 'builder-secondary-actions'); secondary.append(button('Save As', 'save-as', 'builder-button')); secondary.append(button('Open', 'open', 'builder-button')); secondary.append(button('Import / Export', 'import-export', 'builder-button')); secondary.append(button('Use planner layout', 'use-planner', 'builder-button')); transport.appendChild(secondary); root.appendChild(transport);
  }
  function rerenderAction(type, payload) { fire(type, payload); }
  function handleClick(event) {
    const target = event.target.closest('[data-action]'); if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    if (action === 'select-shot') rerenderAction('selectShot', target.dataset.shotId);
    else if (action === 'view') rerenderAction('view', target.dataset.view);
    else if (action === 'workspace-planner') rerenderAction('workspace', 'planner');
    else if (action === 'workspace-builder') rerenderAction('workspace', 'builder');
    else if (action === 'add-shot') rerenderAction('addShot');
    else if (action === 'new') rerenderAction('new');
    else if (action === 'templates') rerenderAction('template');
    else if (action === 'place-target') rerenderAction('placeTarget', { shotId: current.selectedShotId });
    else if (action === 'target-preset') rerenderAction('editShot', { field: 'target', value: { x: Number(target.dataset.x), y: Number(target.dataset.y) } });
    else if (action === 'duplicate-shot') rerenderAction('duplicateShot', current.selectedShotId);
    else if (action === 'delete-shot') rerenderAction('deleteShot', current.selectedShotId);
    else if (action === 'move-earlier') rerenderAction('moveShot', { id: current.selectedShotId, delta: -1 });
    else if (action === 'move-later') rerenderAction('moveShot', { id: current.selectedShotId, delta: 1 });
    else if (action === 'collapse-inspector') root.classList.toggle('builder-inspector-collapsed');
    else if (action === 'play-pause') rerenderAction('playPause');
    else if (action === 'restart' || action === 'previous' || action === 'next' || action === 'undo' || action === 'redo' || action === 'save-as' || action === 'open' || action === 'import-export' || action === 'use-planner') rerenderAction(({ 'save-as': 'saveAs', 'import-export': 'export', 'use-planner': 'usePlanner' }[action] || action));
    else if (action === 'loop') rerenderAction('loop', !current.loop);
    else if (action === 'rate') rerenderAction('rate', Number(target.value));
    else if (action === 'title') rerenderAction('title', target.value);
    else if (action === 'help') rerenderAction('help');
    else if (action === 'camera') rerenderAction('camera', target.value);
  }
  function handleChange(event) {
    const target = event.target; if (!target.dataset.action && !target.dataset.assistance) return;
    if (target.dataset.assistance) fire('assistance', { field: target.dataset.assistance, value: target.checked });
    else if (target.dataset.action === 'title') fire('title', target.value);
    else if (target.dataset.action.startsWith('edit-')) fire('editShot', { field: target.dataset.action.slice(5), value: target.value });
    else if (target.dataset.action === 'rate') fire('rate', Number(target.value));
    else if (target.dataset.action === 'camera') fire('camera', target.value);
    else if (target.dataset.action === 'opening' || target.dataset.action === 'ending') fire(target.dataset.action, target.value);
    else if (target.dataset.action === 'intentionalFault') fire('intentionalFault', target.checked);
    else if (target.dataset.action === 'seek') fire('seek', Number(target.value));
  }
  function handleInput(event) { if (event.target.dataset.action === 'seek') fire('seek', Number(event.target.value)); }
  root.addEventListener('click', handleClick); root.addEventListener('change', handleChange); root.addEventListener('input', handleInput);
  render();
  return { render, destroy() { destroyed = true; root.remove(); document.body.classList.remove('builder-workspace', 'planner-workspace'); }, element: root };
}

export { FAMILIES };
