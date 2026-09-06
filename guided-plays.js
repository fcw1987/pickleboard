import { GuidedPixelActors } from './guided-pixel-actors.js';
// Guided Plays retain their board/snapshot interface and consume the shared timeline.
import { PICKLEBOARD_PLAYS } from './play-catalog.js';
import { compilePlayTimeline, samplePlayBall, boardToWorld, FEET_TO_METERS } from './three-d-core.js';
import { sampleActorPresentation } from './three-d-presentation.js';
import { CoachingSession } from './coaching-session.js';
import { updateCoachingUI } from './coaching-ui.js';

class GuidedPlayEngine {
    constructor(board, plays, elements) {
        this.board = board;
        this.pixelActors = new GuidedPixelActors(board);
        this.plays = new Map(plays.map(play => [play.id, play]));
        this.elements = elements;
        this.activePlay = null;
        this.snapshot = null;
        this.session = new CoachingSession();
        this.clock = this.session.clock;
        this.timeline = null;
        this.stepIndex = 0;
        this.status = 'idle';
        this.animationFrame = null;
        this.advanceTimer = null;
        this.runId = 0;
        this.transition = null;
        this.stepInProgress = false;
        this.timingScale = 1;
        this.stepHoldMs = 1100; // Retained test/API compatibility; no extra per-step clock.
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.lastRenderedStep = null;
        this.bindControls();
        this.renderLibrary();
        this.updateUI();
        document.addEventListener('visibilitychange', () => {
            this.clock.lastTimestamp = null;
            if (document.hidden) this.cancelScheduledWork({ preserveTransition: true });
            else if (this.activePlay && this.session.owner === 'guided' && this.clock.playing) this.startPlaybackLoop();
        });
        this.resizeObserver = new ResizeObserver(() => this.reserveControlSpace());
        this.resizeObserver.observe(this.elements.controls);
    }
    list() { return [...this.plays.values()].map(({ id, name, description }) => ({ id, name, description })); }
    getState() {
        return { status: this.status, playId: this.activePlay?.id || null,
            stepIndex: this.activePlay ? this.stepIndex : null, stepCount: this.activePlay?.steps.length || 0,
            playing: this.clock.playing, elapsed: this.clock.elapsed, loop: this.session.loop,
            holding: this.session.holding, iteration: this.session.iteration, playbackRate: this.clock.playbackRate };
    }
    renderLibrary() {
        this.elements.library.replaceChildren();
        this.plays.forEach(play => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'menu-btn play-library-btn';
            button.dataset.playId = play.id; button.textContent = play.name;
            button.addEventListener('click', () => this.load(play.id));
            this.elements.library.appendChild(button);
        });
    }
    bindControls() {
        this.elements.previous.addEventListener('click', () => this.previous());
        this.elements.playPause.addEventListener('click', () => this.togglePlayPause());
        this.elements.next.addEventListener('click', () => this.next());
        this.elements.restart.addEventListener('click', () => this.restart());
        this.elements.exit.addEventListener('click', () => this.exit());
        this.elements.loop?.addEventListener('click', () => this.setLoop(!this.session.loop));
        this.elements.rate?.addEventListener('change', event => this.setPlaybackRate(Number(event.target.value)));
    }
    load(playId) {
        const play = this.plays.get(playId);
        if (!play) return false;
        if (this.activePlay) this.exit();
        this.validatePlay(play);
        const timeline = compilePlayTimeline(play);
        this.snapshot = this.board.captureBoardState();
        this.board.prepareForPlay(); this.board.setPlayInteractionLocked(true);
        this.board.setGameMode(play.mode, { source: 'playback' });
        this.activePlay = play; this.timeline = timeline;
        this.session.reset(timeline.duration); this.session.owner = 'guided';
        this.status = 'paused'; this.stepIndex = 0; this.lastRenderedStep = null;
        this.elements.controls.hidden = false; document.body.classList.add('play-mode');
        this.board.closeMenu(); this.applyAtTime(0); this.updateUI(true); this.reserveControlSpace();
        const snapshot=this.snapshot;
        this.pixelActors.load().then(loaded=>{if(loaded&&this.activePlay===play&&this.snapshot===snapshot)this.applyAtTime(this.clock.elapsed);}).catch(()=>{
            // Static approved actors remain usable if optional action sheets fail.
            if(this.activePlay===play)this.elements.announcement.textContent='Animated athletes could not load. The lesson and controls remain available.';
        });
        return true;
    }
    validatePlay(play) {
        if (!play.id || !play.name || play.mode !== 'doubles' || !Array.isArray(play.steps) || !play.steps.length) {
            throw new Error(`Invalid play definition: ${play.id || 'unknown'}`);
        }
        for (const step of play.steps) {
            for (const [tokenId, position] of Object.entries(step.positions || {})) {
                if (!this.board.tokens[tokenId] || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
                    throw new Error(`Invalid ${play.id} step ${step.id} position for ${tokenId}`);
                }
            }
        }
    }

    renderShotPath(shot) {
        this.clearShotPath();
        if (!shot) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('play-shot-path');
        path.setAttribute('d', `M ${shot.from.x} ${shot.from.y} L ${shot.to.x} ${shot.to.y}`);
        path.setAttribute('marker-end', 'url(#playArrowhead)');
        this.elements.pathLayer.appendChild(path);
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length);
        this.currentShotPath = { element: path, length };
        if (this.reducedMotion.matches) this.updateShotProgress(1);
    }

    updateShotProgress(progress) {
        if (!this.currentShotPath) return;
        this.currentShotPath.element.style.strokeDashoffset = String(this.currentShotPath.length * (1 - progress));
    }

    clearShotPath() {
        this.elements.pathLayer.replaceChildren();
        this.currentShotPath = null;
    }

    togglePlayPause() { return this.clock.playing ? this.pause() : this.play(); }
    play() {
        if (!this.activePlay) return false;
        if (this.clock.playing) return true;
        this.cancelScheduledWork({ preserveTransition: true });
        this.session.play(); this.status = 'playing';
        this.updateUI(true); this.startPlaybackLoop(); return true;
    }
    pause() {
        if (!this.activePlay) return false;
        this.session.pause(performance.now(), this.timingScale);
        this.cancelScheduledWork({ preserveTransition: true });
        this.status = this.session.complete ? 'complete' : 'paused';
        this.updateUI(true); return true;
    }
    setLoop(enabled) {
        this.session.setLoop(enabled, performance.now(), this.timingScale);
        if (!this.clock.playing) this.cancelScheduledWork({ preserveTransition: true });
        this.status = this.session.complete ? 'complete' : this.clock.playing ? 'playing' : this.activePlay ? 'paused' : 'idle';
        this.updateUI(true); this.board.threeD?.updateUI?.();
    }
    setPlaybackRate(rate) {
        if (this.session.holding && this.clock.playing) this.session.tick(performance.now(), this.timingScale);
        this.clock.setRate(rate); this.clock.lastTimestamp = null;
        this.cancelHold();
        if (this.session.holding && this.clock.playing) this.scheduleHold();
        this.updateUI(true); this.board.threeD?.updateUI?.();
    }
    segmentEndpointTime(index) {
        return index <= 0 ? 0 : this.timeline.segments[Math.min(index - 1, this.timeline.segments.length - 1)].endTime;
    }
    goToStep(index, { automatic = false } = {}) {
        if (!this.activePlay) return false;
        this.cancelScheduledWork(); this.session.seek(this.segmentEndpointTime(index));
        this.applyAtTime(this.clock.elapsed); this.status = 'paused'; this.updateUI(true);
        if (automatic) this.play(); return true;
    }
    next() { return this.activePlay && this.stepIndex < this.activePlay.steps.length - 1 ? this.goToStep(this.stepIndex + 1) : false; }
    previous() { return this.activePlay && this.stepIndex > 0 ? this.goToStep(this.stepIndex - 1) : false; }
    restart() {
        if (!this.activePlay) return false;
        this.cancelScheduledWork(); this.session.seek(0); this.lastRenderedStep = null;
        this.status = 'paused'; this.applyAtTime(0); this.updateUI(true); return true;
    }
    exit() {
        if (!this.activePlay) return false;
        this.board.threeD?.cancelLoading?.();
        if (this.board.threeD?.active) this.board.threeD.exit();
        this.cancelScheduledWork(); this.session.reset(0); this.session.owner = 'guided';
        this.pixelActors.dispose();
        this.clearShotPath(); const snapshot = this.snapshot;
        this.activePlay = null; this.snapshot = null; this.timeline = null;
        this.status = 'idle'; this.stepIndex = 0; this.lastRenderedStep = null;
        this.elements.controls.hidden = true; document.body.classList.remove('play-mode');
        this.board.playBallHeight = 0;
        this.board.restoreBoardState(snapshot); this.board.setPlayInteractionLocked(false);
        this.updateUI(); this.reserveControlSpace(); return true;
    }
    cancelHold() {
        if (this.advanceTimer !== null) clearTimeout(this.advanceTimer);
        this.advanceTimer = null;
    }
    cancelScheduledWork({ preserveTransition = false } = {}) {
        this.runId += 1;
        if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null; this.cancelHold();
        if (!preserveTransition) { this.transition = null; this.stepInProgress = false; }
    }
    scheduleHold() {
        this.cancelHold();
        if (!this.activePlay || !this.session.holding || !this.clock.playing || document.hidden) return;
        const runId = this.runId, play = this.activePlay;
        this.advanceTimer = setTimeout(() => {
            this.advanceTimer = null;
            if (runId !== this.runId || this.activePlay !== play || !this.clock.playing || document.hidden) return;
            this.session.tick(performance.now(), this.timingScale);
            if (this.session.owner === 'replay') this.board.threeD?.startRenderLoop();
            else this.startPlaybackLoop();
        }, Math.max(1, this.session.remainingHoldMs(this.timingScale)));
    }
    startPlaybackLoop() {
        if (!this.activePlay || this.session.owner !== 'guided' || !this.clock.playing || document.hidden || this.animationFrame !== null) return;
        const runId = this.runId;
        const frame = timestamp => {
            this.animationFrame = null;
            if (runId !== this.runId || !this.activePlay || this.session.owner !== 'guided' || !this.clock.playing || document.hidden) return;
            this.session.tick(timestamp, this.timingScale);
            this.applyAtTime(this.clock.elapsed);
            this.status = this.session.complete ? 'complete' : this.clock.playing ? 'playing' : 'paused';
            this.updateUI();
            if (this.session.holding) this.scheduleHold();
            else if (this.clock.playing) this.animationFrame = requestAnimationFrame(frame);
        };
        this.animationFrame = requestAnimationFrame(frame);
    }
    applyPositions(positions) { this.board.applyPlayPositions(positions); }
    applyAtTime(seconds) {
        if (!this.activePlay || !this.timeline) return;
        const segment = seconds > 0 ? this.timeline.segments.find(item => seconds <= item.endTime) || this.timeline.segments.at(-1) : null;
        const local = segment ? Math.max(0, Math.min(segment.duration, seconds - segment.startTime)) : 0;
        const positions = {}, samples = {};
        for (const id of ['player1', 'player2', 'player3', 'player4']) {
            const sample = segment ? sampleActorPresentation({ segment, timeline: this.timeline, seconds, playerId: id, localTime: local,
                cameraPosition: { x: 0, y: 12, z: 10 }, cameraTarget: { x: 0, y: 0, z: 0 }, handedness: this.board.tokens[id].handedness }) : null;
            const p=sample?.worldPosition||boardToWorld(this.activePlay.steps[0].positions[id]);
            if(sample){
                const distance=segment.shotSemantics?.playerId===id?Math.abs(local-segment.contactTime):segment.nextShotSemantics?.playerId===id?Math.abs(segment.duration-local):Infinity;
                const blend=Math.max(0,1-distance/.18);
                samples[id]={...sample,contactWeight:blend*blend*(3-2*blend)};
            }else samples[id]={action:'ready',phase:'ready',viewDirection:this.activePlay.steps[0].positions[id].y<22?'front':'back'};
            positions[id] = { x: p.x / FEET_TO_METERS + 10, y: p.z / FEET_TO_METERS + 22 };
        }
        const ball = samplePlayBall(this.timeline, seconds);
        positions.ball = { x: ball.x / FEET_TO_METERS + 10, y: ball.z / FEET_TO_METERS + 22 };
        this.board.playBallHeight = ball.y / FEET_TO_METERS;
        this.applyPositions(positions);
        this.pixelActors.update(samples);
        this.stepIndex = segment?.index || 0;
        this.stepInProgress = Boolean(segment && local < segment.duration - 1e-6);
        this.transition = this.stepInProgress ? { step: segment.step, duration: segment.duration * 1000 * this.timingScale, elapsed: local * 1000 * this.timingScale } : null;
        if (this.lastRenderedStep !== this.stepIndex || this.lastIteration !== this.session.iteration) {
            this.renderShotPath(segment?.step.shot); this.lastRenderedStep = this.stepIndex; this.lastIteration = this.session.iteration;
        }
        this.updateShotProgress(segment ? Math.max(0, Math.min(1, (local - (segment.contactTime || 0)) / Math.max(.001, segment.duration - (segment.contactTime || 0)))) : 0);
        this.lastState = { ...ball, elapsed: seconds, stepIndex: this.stepIndex, segment, local };
    }
    reserveControlSpace() {
        const rect=this.elements.controls.getBoundingClientRect();
        const side=innerHeight<=500&&innerWidth>innerHeight;
        const height = this.activePlay && !this.elements.controls.hidden && !side ? rect.height + 24 : 0;
        document.documentElement.style.setProperty('--coaching-hud-width',`${this.activePlay&&side?rect.width+24:0}px`);
        document.documentElement.style.setProperty('--coaching-hud-height', `${height}px`);
    }
    updateUI(manual = false) {
        const active = Boolean(this.activePlay);
        const step = active ? this.activePlay.steps[this.stepIndex] : null;
        const state = this.lastState;
        const cueStep = this.timeline?.segments.find(s=>s.rallyLeg===state?.rallyLeg)?.step;
        updateCoachingUI(this.elements, { playId: this.activePlay?.id, title: this.activePlay?.name,
            stepIndex: this.stepIndex, stepCount: this.activePlay?.steps.length, label: step?.label, description: step?.description,
            shotType: cueStep?.shot?.type || step?.shot?.type, nextShot: Boolean(cueStep && cueStep.id !== step?.id), phase: this.session.holding ? 'complete' : state?.phase || 'ready',
            elapsed: this.clock.elapsed, eventTime: state?.segment?.startTime || 0, playing: this.clock.playing,
            loop: this.session.loop, reducedMotion: this.reducedMotion.matches, manual });
        const text = this.clock.playing ? 'Pause' : this.session.holding ? 'Resume' : this.status === 'complete' || (this.timeline && this.clock.elapsed >= this.timeline.duration) ? 'Replay' : 'Play';
        if (this.elements.playPause.textContent !== text) this.elements.playPause.textContent = text;
        this.elements.playPause.setAttribute('aria-pressed', String(this.clock.playing));
        this.elements.previous.disabled = !active || this.stepIndex === 0 || this.clock.playing;
        this.elements.next.disabled = !active || this.stepIndex === this.activePlay?.steps.length - 1 || this.clock.playing;
        this.elements.restart.disabled = !active; this.elements.exit.disabled = !active;
        if (this.elements.rate) this.elements.rate.value = String(this.clock.playbackRate);
        if (manual && active && this.elements.announcement) this.elements.announcement.textContent = `${this.activePlay.name}. Step ${this.stepIndex + 1}. ${step.label}. ${step.description}`;
    }
}
window.PICKLEBOARD_PLAYS = PICKLEBOARD_PLAYS;
window.GuidedPlayEngine = GuidedPlayEngine;
export { GuidedPlayEngine };
