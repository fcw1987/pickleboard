// Versioned, renderer-independent source data for the visual play builder.
import { PICKLEBOARD_PLAYS } from './play-catalog.js';
export const SCHEMA_VERSION = 1;
export const MAX_SHOTS = 64;

const PLAYER_IDS = Object.freeze(['player1', 'player2', 'player3', 'player4']);
const FAMILIES = Object.freeze(['serve', 'return', 'drive', 'drop', 'dink', 'volley', 'reset', 'lob', 'overhead']);
const CONTACT_STYLES = Object.freeze(['auto', 'forehand', 'backhand', 'short-hop']);
const ARCS = Object.freeze(['low', 'medium', 'high']);
const PACES = Object.freeze(['soft', 'medium', 'firm']);
const MOVEMENT_INTENTS = Object.freeze(['hold', 'advance', 'recover', 'manual']);
const TEAMS = Object.freeze(['green', 'orange']);
const HANDS = Object.freeze(['right', 'left']);

const copy = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const fail = (path, message) => { throw new TypeError(`${path} ${message}`); };
function assertJsonBounds(value, path = 'document', depth = 0, budget = { nodes: 0 }) {
  if (depth > 12) fail(path, 'must not exceed 12 levels of nesting.');
  if (++budget.nodes > 10000) fail(path, 'contains too many values.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(path, 'must not contain non-finite numbers.'); return; }
  if (typeof value === 'string') { if (value.length > 32768) fail(path, 'contains an oversized string.'); return; }
  if (typeof value !== 'object') fail(path, 'must contain only JSON data.');
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(path, `contains forbidden key ${key}.`);
    assertJsonBounds(value[key], `${path}.${key}`, depth + 1, budget);
  }
}
const object = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object.');
  return value;
};
const string = (value, path, max = 120) => {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) fail(path, `must be a non-empty string of at most ${max} characters.`);
  if (/[<>\u0000-\u001f\u007f]/.test(value)) fail(path, 'must be plain text without markup or control characters.');
};
const choice = (value, choices, path) => {
  if (!choices.includes(value)) fail(path, `must be one of: ${choices.join(', ')}.`);
};
const point = (value, path, { offCourt = false } = {}) => {
  object(value, path);
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) fail(path, 'must contain finite x and y coordinates.');
  const margin = offCourt ? 8 : 0;
  if (value.x < -margin || value.x > 20 + margin || value.y < -margin || value.y > 44 + margin) fail(path, `must stay within ${offCourt ? 'the supported court apron' : 'the 20 by 44 foot court'}.`);
};

function validateTemplateSource(value) {
  if (value === undefined) return;
  object(value, 'templateSource');
  string(value.templateId, 'templateSource.templateId', 128);
  if (!Array.isArray(value.recipeSignatures) || value.recipeSignatures.length > MAX_SHOTS) fail('templateSource.recipeSignatures', `must be an array of at most ${MAX_SHOTS} strings.`);
  value.recipeSignatures.forEach((signature, index) => string(signature, `templateSource.recipeSignatures[${index}]`, 4096));
  string(value.documentSignature, 'templateSource.documentSignature', 32768);
  object(value.play, 'templateSource.play');
  string(value.play.id, 'templateSource.play.id', 128);
  if (!Array.isArray(value.play.steps) || !value.play.steps.length || value.play.steps.length > MAX_SHOTS + 8) fail('templateSource.play.steps', 'must contain a bounded source play.');
  value.play.steps.forEach((step, index) => {
    object(step, `templateSource.play.steps[${index}]`);
    object(step.positions, `templateSource.play.steps[${index}].positions`);
    for (const id of [...PLAYER_IDS, 'ball']) point(step.positions[id], `templateSource.play.steps[${index}].positions.${id}`, { offCourt: true });
    if (step.shot) {
      point(step.shot.from, `templateSource.play.steps[${index}].shot.from`, { offCourt: true });
      point(step.shot.to, `templateSource.play.steps[${index}].shot.to`);
    }
  });
  const trusted = PICKLEBOARD_PLAYS.find(play => play.id === value.templateId);
  if (!trusted) fail('templateSource.templateId', 'must identify a trusted built-in lesson.');
  if (JSON.stringify(value.play) !== JSON.stringify(trusted)) fail('templateSource.play', 'must exactly match the trusted built-in lesson snapshot.');
  const expected = templateRecipes(trusted);
  if (JSON.stringify(value.recipeSignatures) !== JSON.stringify(expected.map(signature))) fail('templateSource.recipeSignatures', 'must exactly describe the trusted lesson recipes.');
  if (value.documentSignature !== documentCompatibilitySignature(templateBaseFields(trusted))) fail('templateSource.documentSignature', 'must exactly describe the trusted lesson document fields.');
}

export function validateDocument(value) {
  assertJsonBounds(value);
  object(value, 'document');
  if (value.schemaVersion !== SCHEMA_VERSION) fail('schemaVersion', `must be ${SCHEMA_VERSION}.`);
  if (value.modelVersion !== 1) fail('modelVersion', 'must be 1.');
  string(value.id, 'id', 128);
  string(value.title, 'title', 120);
  object(value.initialLayout, 'initialLayout');
  for (const id of PLAYER_IDS) point(value.initialLayout[id], `initialLayout.${id}`, { offCourt: true });
  point(value.initialLayout.ball, 'initialLayout.ball', { offCourt: true });
  object(value.players, 'players');
  for (const id of PLAYER_IDS) {
    object(value.players[id], `players.${id}`);
    choice(value.players[id].team, TEAMS, `players.${id}.team`);
    choice(value.players[id].handedness, HANDS, `players.${id}.handedness`);
    const requiredTeam = ['player1', 'player2'].includes(id) ? 'green' : 'orange';
    if (value.players[id].team !== requiredTeam) fail(`players.${id}.team`, `must remain ${requiredTeam} in schema version 1 so player identity agrees with the approved artwork and renderers.`);
  }
  if (!Array.isArray(value.shots)) fail('shots', 'must be an array.');
  if (value.shots.length > MAX_SHOTS) fail('shots', `must contain at most ${MAX_SHOTS} recipes.`);
  const ids = new Set();
  value.shots.forEach((shot, index) => {
    const path = `shots[${index}]`;
    object(shot, path);
    string(shot.id, `${path}.id`, 128);
    if (ids.has(shot.id)) fail(`${path}.id`, 'must be unique.');
    ids.add(shot.id);
    choice(shot.family, FAMILIES, `${path}.family`);
    choice(shot.hitter, PLAYER_IDS, `${path}.hitter`);
    if (shot.receiver !== 'auto') choice(shot.receiver, PLAYER_IDS, `${path}.receiver`);
    choice(shot.contactStyle, CONTACT_STYLES, `${path}.contactStyle`);
    point(shot.target, `${path}.target`);
    choice(shot.arc, ARCS, `${path}.arc`);
    choice(shot.pace, PACES, `${path}.pace`);
    object(shot.movement, `${path}.movement`);
    choice(shot.movement.intent, MOVEMENT_INTENTS, `${path}.movement.intent`);
    if (typeof shot.movement.pinned !== 'boolean') fail(`${path}.movement.pinned`, 'must be boolean.');
    if (shot.movement.target !== undefined) point(shot.movement.target, `${path}.movement.target`, { offCourt: true });
    if (shot.movement.intent === 'manual' && !shot.movement.target) fail(`${path}.movement.target`, 'is required for manual movement.');
    if (shot.movement.waypoints !== undefined) {
      if (!Array.isArray(shot.movement.waypoints) || shot.movement.waypoints.length > 8) fail(`${path}.movement.waypoints`, 'must contain at most 8 points.');
      shot.movement.waypoints.forEach((item, waypointIndex) => point(item, `${path}.movement.waypoints[${waypointIndex}]`, { offCourt: true }));
    }
    if (shot.family === 'serve') choice(shot.serveMethod, ['volley', 'drop'], `${path}.serveMethod`);
    else if (shot.serveMethod !== undefined) fail(`${path}.serveMethod`, 'is only valid for a serve.');
  });
  if (!Array.isArray(value.annotations) || value.annotations.length > 64) fail('annotations', 'must be an array of at most 64 items.');
  // Annotations remain inert JSON data. Bound their serialized size for safe import.
  let annotationBytes;
  try { annotationBytes = JSON.stringify(value.annotations).length; } catch { fail('annotations', 'must be JSON serializable.'); }
  if (annotationBytes > 32768) fail('annotations', 'must serialize to at most 32768 characters.');
  object(value.assistance, 'assistance');
  if (typeof value.assistance.autoShading !== 'boolean' || typeof value.assistance.showGuides !== 'boolean') fail('assistance', 'toggles must be boolean.');
  choice(value.assistance.team, ['both', ...TEAMS], 'assistance.team');
  choice(value.opening, ['serve', 'midrally'], 'opening');
  choice(value.ending, ['stop', 'winner', 'fault'], 'ending');
  if (typeof value.intentionalFault !== 'boolean') fail('intentionalFault', 'must be boolean.');
  validateTemplateSource(value.templateSource);
  return value;
}

const movement = () => ({ intent: 'hold', pinned: false });
const defaultPlayers = () => ({
  player1: { team: 'green', handedness: 'right' }, player2: { team: 'green', handedness: 'right' },
  player3: { team: 'orange', handedness: 'right' }, player4: { team: 'orange', handedness: 'right' }
});
const templateBaseFields = play => ({
  initialLayout: copy(play.steps[0].positions), players: defaultPlayers(), annotations: [],
  assistance: { autoShading: false, showGuides: false, team: 'both' },
  opening: play.rally?.openingBouncesSatisfied ? 'midrally' : 'serve', ending: 'stop', intentionalFault: false
});

export function createStarterDocument() {
  const document = {
    schemaVersion: SCHEMA_VERSION,
    modelVersion: 1,
    id: 'starter-draft',
    title: 'Starter Serve, Return & Third',
    initialLayout: {
      player1: { x: 15, y: -1 }, player2: { x: 5, y: -1 },
      player3: { x: 5, y: 42 }, player4: { x: 15, y: 30 }, ball: { x: 16.2, y: 0 }
    },
    players: {
      player1: { team: 'green', handedness: 'right' }, player2: { team: 'green', handedness: 'right' },
      player3: { team: 'orange', handedness: 'right' }, player4: { team: 'orange', handedness: 'left' }
    },
    shots: [
      { id: 'serve-1', family: 'serve', hitter: 'player1', receiver: 'player3', contactStyle: 'forehand', target: { x: 5, y: 38 }, arc: 'high', pace: 'medium', movement: { intent: 'hold', pinned: false }, serveMethod: 'volley' },
      { id: 'return-2', family: 'return', hitter: 'player3', receiver: 'player1', contactStyle: 'forehand', target: { x: 15, y: 6 }, arc: 'high', pace: 'medium', movement: { intent: 'advance', pinned: false } },
      { id: 'drop-3', family: 'drop', hitter: 'player1', receiver: 'auto', contactStyle: 'forehand', target: { x: 7, y: 27 }, arc: 'high', pace: 'soft', movement: { intent: 'advance', pinned: false } }
    ],
    annotations: [],
    assistance: { autoShading: false, showGuides: false, team: 'both' },
    opening: 'serve', ending: 'stop', intentionalFault: false
  };
  validateDocument(document);
  return document;
}

function inferFamily(shot) {
  if (shot.type === 'block') return 'volley';
  if (shot.type === 'short-hop') return 'reset';
  return FAMILIES.includes(shot.type) ? shot.type : shot.stroke === 'forehand' || shot.stroke === 'backhand' ? 'return' : 'drive';
}
function inferArc(shot) {
  const apex = shot.flight?.apexFeet ?? shot.trajectory3d?.apexFeet;
  if (shot.type === 'lob' || apex >= 9) return 'high';
  if (apex !== undefined && apex <= 5.75) return 'low';
  return ['drop', 'dink', 'reset', 'short-hop'].includes(shot.type) ? 'high' : 'medium';
}
function inferPace(shot) {
  const speed = shot.flight?.speedMph ?? shot.trajectory3d?.speedMph;
  if (speed >= 32 || ['drive', 'overhead'].includes(shot.type)) return 'firm';
  if (speed <= 19 || ['drop', 'dink', 'reset', 'short-hop'].includes(shot.type)) return 'soft';
  return 'medium';
}
const signature = shot => JSON.stringify(shot);

function templateRecipes(play) {
  const shotSteps = play.steps.filter(step => step.shot);
  return shotSteps.map((step, index) => {
    const source = step.shot;
    const family = inferFamily(source);
    const contactStyle = source.type === 'short-hop' ? 'short-hop' : (source.contact?.strokeSide ?? (source.stroke === 'backhand' ? 'backhand' : 'forehand'));
    return {
      id: step.id || `shot-${index + 1}`, family, hitter: source.playerId,
      receiver: shotSteps[index + 1]?.shot?.playerId ?? 'auto', contactStyle,
      target: copy(source.to), arc: inferArc(source), pace: inferPace(source), movement: movement(),
      ...(family === 'serve' ? { serveMethod: 'volley' } : {})
    };
  });
}

export function documentCompatibilitySignature(document) {
  return JSON.stringify({
    initialLayout: document.initialLayout, players: document.players,
    opening: document.opening, ending: document.ending,
    intentionalFault: document.intentionalFault
  });
}

export function documentFromTemplate(play) {
  object(play, 'play');
  if (!Array.isArray(play.steps) || !play.steps.length) fail('play.steps', 'must contain a setup step.');
  const setup = play.steps[0];
  object(setup.positions, 'play.steps[0].positions');
  const trusted = PICKLEBOARD_PLAYS.find(item => item.id === play.id);
  if (!trusted || JSON.stringify(play) !== JSON.stringify(trusted)) fail('play', 'must exactly match one of the trusted built-in lessons.');
  const shots = templateRecipes(play);
  const document = {
    schemaVersion: SCHEMA_VERSION, modelVersion: 1, id: `${play.id}-copy`, title: `${play.name || play.id} Copy`,
    initialLayout: copy(setup.positions),
    players: defaultPlayers(),
    shots, annotations: [], assistance: { autoShading: false, showGuides: false, team: 'both' },
    opening: play.rally?.openingBouncesSatisfied ? 'midrally' : 'serve', ending: 'stop', intentionalFault: false,
    templateSource: { templateId: play.id, recipeSignatures: shots.map(signature), documentSignature: '', play: copy(play) }
  };
  document.templateSource.documentSignature = documentCompatibilitySignature(document);
  validateDocument(document);
  return document;
}

export const PLAY_DOCUMENT_ENUMS = Object.freeze({
  players: PLAYER_IDS, families: FAMILIES, contactStyles: CONTACT_STYLES,
  arcs: ARCS, paces: PACES, movementIntents: MOVEMENT_INTENTS
});
