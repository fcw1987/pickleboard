// Guided Plays: declarative pickleball sequences and reusable playback engine.

const COMMON_PLAY_STEPS = {
    setup: {
        id: 'setup',
        label: 'Starting Positions',
        description: 'Green prepares to serve while Orange sets a returner deep and a partner at the kitchen.',
        durationMs: 0,
        positions: {
            player1: { x: 15, y: -1 },
            player2: { x: 5, y: -1 },
            player3: { x: 5, y: 42 },
            player4: { x: 15, y: 30 },
            ball: { x: 18, y: -1 }
        }
    },
    serve: {
        id: 'serve',
        label: 'Diagonal Serve',
        description: 'Serve deep into the opposite service box. The serve must bounce before the return.',
        durationMs: 900,
        positions: {
            player1: { x: 15, y: 1 },
            player2: { x: 5, y: -1 },
            player3: { x: 5, y: 40 },
            player4: { x: 15, y: 30 },
            ball: { x: 5, y: 38 }
        },
        shot: { from: { x: 18, y: -1 }, to: { x: 5, y: 38 } }
    },
    return: {
        id: 'return',
        label: 'Deep Return and Advance',
        description: 'Return deep, then move toward the kitchen. Green stays back and lets the return bounce.',
        durationMs: 1000,
        positions: {
            player1: { x: 15, y: 4 },
            player2: { x: 5, y: 2 },
            player3: { x: 5, y: 31 },
            player4: { x: 15, y: 30 },
            ball: { x: 15, y: 6 }
        },
        shot: { from: { x: 5, y: 38 }, to: { x: 15, y: 6 } }
    },
    thirdDrop: {
        id: 'third-drop',
        label: 'Third Shot Drop',
        description: 'After the return bounces, a soft third shot lands in the Orange kitchen.',
        durationMs: 950,
        positions: {
            player1: { x: 14, y: 9 },
            player2: { x: 5, y: 9 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 7, y: 27 }
        },
        shot: { from: { x: 15, y: 6 }, to: { x: 7, y: 27 } }
    },
    dropTransition: {
        id: 'drop-transition',
        label: 'Move Through Transition',
        description: 'Green advances together behind the soft drop while Orange protects the kitchen line.',
        durationMs: 850,
        positions: {
            player1: { x: 14, y: 13 },
            player2: { x: 5, y: 12.5 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 7, y: 27 }
        }
    },
    thirdDrive: {
        id: 'third-drive',
        label: 'Third Shot Drive',
        description: 'Green drives low at the established kitchen team, advancing only into transition.',
        durationMs: 900,
        positions: {
            player1: { x: 14.5, y: 8.5 },
            player2: { x: 5, y: 8 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 14.5, y: 29.5 }
        },
        shot: { from: { x: 15, y: 6 }, to: { x: 14.5, y: 29.5 } }
    },
    block: {
        id: 'fourth-block',
        label: 'Compact Fourth-Shot Block',
        description: 'Orange absorbs the drive and blocks short. Green remains balanced for the next ball.',
        durationMs: 850,
        positions: {
            player1: { x: 13.5, y: 10 },
            player2: { x: 5, y: 9.5 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 13.5, y: 12 }
        },
        shot: { from: { x: 14.5, y: 29.5 }, to: { x: 13.5, y: 12 } }
    },
    fifthDrop: {
        id: 'fifth-drop',
        label: 'Fifth Shot Drop',
        description: 'After the block bounces, Green drops the fifth softly into the Orange kitchen.',
        durationMs: 950,
        positions: {
            player1: { x: 14, y: 12.5 },
            player2: { x: 5, y: 12 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 14, y: 27 }
        },
        shot: { from: { x: 13.5, y: 12 }, to: { x: 14, y: 27 } }
    },
    fifthTransition: {
        id: 'fifth-transition',
        label: 'Close in Together',
        description: 'Green follows the fifth-shot drop forward together, ready to earn the kitchen line.',
        durationMs: 800,
        positions: {
            player1: { x: 14, y: 14 },
            player2: { x: 5, y: 13.5 },
            player3: { x: 5, y: 30 },
            player4: { x: 15, y: 30 },
            ball: { x: 14, y: 27 }
        }
    }
};

const PICKLEBOARD_PLAYS = Object.freeze([
    {
        id: 'serve-and-return',
        name: 'Serve & Return',
        description: 'See the legal opening pattern and the returner’s move to the kitchen.',
        mode: 'doubles',
        steps: [COMMON_PLAY_STEPS.setup, COMMON_PLAY_STEPS.serve, COMMON_PLAY_STEPS.return]
    },
    {
        id: 'third-shot-drop',
        name: 'Third Shot Drop',
        description: 'Use a soft third shot to begin a controlled transition forward.',
        mode: 'doubles',
        steps: [COMMON_PLAY_STEPS.setup, COMMON_PLAY_STEPS.serve, COMMON_PLAY_STEPS.return,
            COMMON_PLAY_STEPS.thirdDrop, COMMON_PLAY_STEPS.dropTransition]
    },
    {
        id: 'third-shot-drive',
        name: 'Third Shot Drive',
        description: 'Pressure the kitchen team with a low drive and prepare for another ball.',
        mode: 'doubles',
        steps: [COMMON_PLAY_STEPS.setup, COMMON_PLAY_STEPS.serve, COMMON_PLAY_STEPS.return,
            COMMON_PLAY_STEPS.thirdDrive, COMMON_PLAY_STEPS.block]
    },
    {
        id: 'fifth-shot-drop',
        name: 'Fifth Shot Drop',
        description: 'Drive the third, expect a block, then use the fifth to transition.',
        mode: 'doubles',
        steps: [COMMON_PLAY_STEPS.setup, COMMON_PLAY_STEPS.serve, COMMON_PLAY_STEPS.return,
            COMMON_PLAY_STEPS.thirdDrive, COMMON_PLAY_STEPS.block,
            COMMON_PLAY_STEPS.fifthDrop, COMMON_PLAY_STEPS.fifthTransition]
    }
]);

class GuidedPlayEngine {
    constructor(board, plays, elements) {
        this.board = board;
        this.plays = new Map(plays.map(play => [play.id, play]));
        this.elements = elements;
        this.activePlay = null;
        this.snapshot = null;
        this.stepIndex = 0;
        this.status = 'idle';
        this.animationFrame = null;
        this.advanceTimer = null;
        this.runId = 0;
        this.stepInProgress = false;
        this.timingScale = 1;
        this.stepHoldMs = 1100;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.bindControls();
        this.renderLibrary();
        this.updateUI();
    }

    list() {
        return [...this.plays.values()].map(({ id, name, description }) => ({ id, name, description }));
    }

    getState() {
        return {
            status: this.status,
            playId: this.activePlay?.id || null,
            stepIndex: this.activePlay ? this.stepIndex : null,
            stepCount: this.activePlay?.steps.length || 0
        };
    }

    renderLibrary() {
        this.elements.library.replaceChildren();
        this.plays.forEach(play => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu-btn play-library-btn';
            button.dataset.playId = play.id;
            button.textContent = play.name;
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
    }

    load(playId) {
        const play = this.plays.get(playId);
        if (!play) return false;
        if (this.activePlay) this.exit();

        this.validatePlay(play);
        this.snapshot = this.board.captureBoardState();
        this.board.prepareForPlay();
        this.board.setPlayInteractionLocked(true);
        this.board.setGameMode(play.mode, { source: 'playback' });
        this.activePlay = play;
        this.stepIndex = 0;
        this.status = 'paused';
        this.applyPositions(play.steps[0].positions);
        this.clearShotPath();
        this.elements.controls.hidden = false;
        document.body.classList.add('play-mode');
        this.board.closeMenu();
        this.updateUI();
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

    togglePlayPause() {
        if (this.status === 'playing') this.pause();
        else this.play();
    }

    play() {
        if (!this.activePlay) return false;
        if (this.status === 'complete') {
            this.restart();
        }
        this.status = 'playing';
        this.stepInProgress = false;
        this.updateUI();

        if (this.stepIndex < this.activePlay.steps.length - 1) {
            this.goToStep(this.stepIndex + 1, { automatic: true });
        } else {
            this.finishPlayback();
        }
        return true;
    }

    pause() {
        if (!this.activePlay) return false;
        this.cancelScheduledWork();
        this.status = 'paused';
        this.updateUI();
        return true;
    }

    next() {
        if (!this.activePlay || this.stepIndex >= this.activePlay.steps.length - 1) return false;
        this.cancelScheduledWork();
        this.status = 'paused';
        this.goToStep(this.stepIndex + 1, { automatic: false });
        return true;
    }

    previous() {
        if (!this.activePlay || this.stepIndex <= 0) return false;
        this.cancelScheduledWork();
        const targetIndex = this.stepIndex - 1;
        this.status = 'paused';
        this.applyPositions(this.activePlay.steps[targetIndex].positions);
        this.stepIndex = targetIndex;
        this.stepInProgress = false;
        this.renderShotPath(this.activePlay.steps[targetIndex].shot);
        this.updateShotProgress(1);
        this.updateUI();
        return true;
    }

    restart() {
        if (!this.activePlay) return false;
        this.cancelScheduledWork();
        this.stepIndex = 0;
        this.status = 'paused';
        this.stepInProgress = false;
        this.applyPositions(this.activePlay.steps[0].positions);
        this.clearShotPath();
        this.updateUI();
        return true;
    }

    exit() {
        if (!this.activePlay) return false;
        this.cancelScheduledWork();
        this.clearShotPath();
        const snapshot = this.snapshot;
        this.activePlay = null;
        this.snapshot = null;
        this.status = 'idle';
        this.stepIndex = 0;
        this.stepInProgress = false;
        this.elements.controls.hidden = true;
        document.body.classList.remove('play-mode');
        this.board.restoreBoardState(snapshot);
        this.board.setPlayInteractionLocked(false);
        this.updateUI();
        return true;
    }

    goToStep(index, { automatic }) {
        this.cancelScheduledWork();
        const step = this.activePlay.steps[index];
        const startPositions = this.board.getTokenPositions();
        this.stepIndex = index;
        this.stepInProgress = true;
        if (automatic) this.status = 'playing';
        this.renderShotPath(step.shot);
        this.updateUI();

        const duration = this.reducedMotion.matches ? 0 : Math.max(1, step.durationMs * this.timingScale);
        if (duration === 0) {
            this.applyPositions(step.positions);
            this.completeStep(automatic);
            return;
        }

        const runId = ++this.runId;
        const startedAt = performance.now();
        const animate = now => {
            if (runId !== this.runId || !this.activePlay) return;
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            const positions = {};
            Object.entries(step.positions).forEach(([tokenId, target]) => {
                const start = startPositions[tokenId];
                positions[tokenId] = {
                    x: start.x + (target.x - start.x) * eased,
                    y: start.y + (target.y - start.y) * eased
                };
            });
            this.applyPositions(positions);
            this.updateShotProgress(progress);
            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this.applyPositions(step.positions);
                this.completeStep(automatic);
            }
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    completeStep(automatic) {
        this.animationFrame = null;
        this.stepInProgress = false;
        if (automatic && this.stepIndex < this.activePlay.steps.length - 1) {
            const delay = Math.max(20, this.stepHoldMs * this.timingScale);
            this.advanceTimer = setTimeout(() => this.goToStep(this.stepIndex + 1, { automatic: true }), delay);
        } else if (automatic) {
            this.finishPlayback();
        } else {
            this.status = 'paused';
            this.updateUI();
        }
    }

    finishPlayback() {
        this.cancelScheduledWork();
        this.status = 'complete';
        this.stepInProgress = false;
        this.updateUI();
    }

    cancelScheduledWork() {
        this.runId += 1;
        if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
        if (this.advanceTimer !== null) clearTimeout(this.advanceTimer);
        this.animationFrame = null;
        this.advanceTimer = null;
    }

    applyPositions(positions) {
        this.board.applyPlayPositions(positions);
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

    updateUI() {
        const active = Boolean(this.activePlay);
        const step = active ? this.activePlay.steps[this.stepIndex] : null;
        this.elements.title.textContent = active ? this.activePlay.name : '';
        this.elements.stepLabel.textContent = step?.label || '';
        this.elements.description.textContent = step?.description || '';
        this.elements.progress.textContent = active ? `Step ${this.stepIndex + 1} of ${this.activePlay.steps.length}` : '';
        this.elements.playPause.textContent = this.status === 'playing' ? 'Pause' : this.status === 'complete' ? 'Replay' : 'Play';
        this.elements.playPause.setAttribute('aria-pressed', String(this.status === 'playing'));
        this.elements.previous.disabled = !active || this.stepIndex === 0 || this.status === 'playing';
        this.elements.next.disabled = !active || this.stepIndex === this.activePlay?.steps.length - 1 || this.status === 'playing';
        this.elements.restart.disabled = !active;
        this.elements.exit.disabled = !active;
        if (active) {
            this.elements.announcement.textContent = `${this.activePlay.name}. ${this.elements.progress.textContent}. ${step.label}. ${step.description}`;
        }
    }
}

window.PICKLEBOARD_PLAYS = PICKLEBOARD_PLAYS;
window.GuidedPlayEngine = GuidedPlayEngine;
