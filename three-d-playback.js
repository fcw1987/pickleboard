import * as THREE from './vendor/three.module.min.js';
import {
    CAMERA_PRESETS,
    COURT_DIMENSIONS,
    FEET_TO_METERS,
    PlaybackClock,
    boardToWorld,
    compilePlayTimeline
} from './three-d-core.js';

const TEAM_COLORS = { team1: 0x66cc33, team2: 0xff7a00 };
const NAVY = 0x162b5c;

class ThreeDPlaybackViewer {
    constructor(board) {
        this.board = board;
        this.elements = {
            root: document.getElementById('threeDViewer'),
            canvas: document.getElementById('threeDCanvas'),
            title: document.getElementById('threeDTitle'),
            status: document.getElementById('threeDStatus'),
            playPause: document.getElementById('threeDPlayPause'),
            restart: document.getElementById('threeDRestart'),
            camera: document.getElementById('threeDCamera'),
            rate: document.getElementById('threeDRate'),
            exit: document.getElementById('threeDExit'),
            enter: document.getElementById('play3dView')
        };
        this.clock = new PlaybackClock();
        this.active = false;
        this.renderLoopId = null;
        this.renderLoopCount = 0;
        this.currentPlay = null;
        this.timeline = null;
        this.playerObjects = new Map();
        this.ballObject = null;
        this.lastState = null;
        this.boundResize = () => this.resize();
        this.bindControls();
        this.updateEntryAvailability();
    }

    bindControls() {
        this.elements.enter.addEventListener('click', () => this.enter());
        this.elements.playPause.addEventListener('click', () => this.togglePlay());
        this.elements.restart.addEventListener('click', () => this.restart());
        this.elements.camera.addEventListener('change', event => this.setCamera(event.target.value));
        this.elements.rate.addEventListener('change', event => this.setPlaybackRate(Number(event.target.value)));
        this.elements.exit.addEventListener('click', () => this.exit());
    }

    updateEntryAvailability() {
        this.elements.enter.disabled = !this.board.plays?.activePlay;
    }

    enter() {
        const play = this.board.plays?.activePlay;
        if (!play || this.active) return false;
        this.currentPlay = play;
        this.timeline = compilePlayTimeline(play);
        this.clock.restart();
        this.clock.setRate(Number(this.elements.rate.value));
        this.board.plays.pause();
        this.elements.root.hidden = false;
        document.body.classList.add('three-d-active');
        this.initializeScene();
        this.applyAtTime(0);
        this.setCamera(this.elements.camera.value);
        this.active = true;
        window.addEventListener('resize', this.boundResize);
        this.startRenderLoop();
        this.updateUI();
        return true;
    }

    initializeScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x10251b);
        this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.elements.canvas.replaceChildren(this.renderer.domElement);

        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x263d32, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(-5, 10, -4);
        this.scene.add(key);
        this.buildCourt();
        this.buildPlayers();
        this.buildBall();
        this.resize();
    }

    buildCourt() {
        const width = COURT_DIMENSIONS.widthFeet * FEET_TO_METERS;
        const length = COURT_DIMENSIONS.lengthFeet * FEET_TO_METERS;
        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(width, length),
            new THREE.MeshStandardMaterial({ color: 0x315f48, roughness: 0.9 })
        );
        surface.rotation.x = -Math.PI / 2;
        surface.position.y = -0.015;
        this.scene.add(surface);

        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lineWidth = 0.045;
        const addLine = (x, z, w, d) => {
            const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, d), lineMaterial);
            line.position.set(x, 0.008, z);
            this.scene.add(line);
        };
        addLine(0, -length / 2, width, lineWidth);
        addLine(0, length / 2, width, lineWidth);
        addLine(-width / 2, 0, lineWidth, length);
        addLine(width / 2, 0, lineWidth, length);
        const kitchenZ = (22 - 15) * FEET_TO_METERS;
        addLine(0, -kitchenZ, width, lineWidth);
        addLine(0, kitchenZ, width, lineWidth);
        addLine(0, -(length / 2 - 7 * FEET_TO_METERS) / 2, lineWidth, 15 * FEET_TO_METERS);
        addLine(0, (length / 2 - 7 * FEET_TO_METERS) / 2, lineWidth, 15 * FEET_TO_METERS);

        const netHeight = COURT_DIMENSIONS.netCenterHeightFeet * FEET_TO_METERS;
        const net = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 0.55, netHeight),
            new THREE.MeshBasicMaterial({ color: 0xe9eef2, transparent: true, opacity: 0.48, side: THREE.DoubleSide, wireframe: true })
        );
        net.position.set(0, netHeight / 2, 0);
        this.scene.add(net);
        const tape = new THREE.Mesh(new THREE.BoxGeometry(width + 0.55, 0.045, 0.045), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        tape.position.set(0, netHeight, 0);
        this.scene.add(tape);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
        for (const x of [-width / 2 - 0.25, width / 2 + 0.25]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, netHeight + 0.08, 12), postMaterial);
            post.position.set(x, (netHeight + 0.08) / 2, 0);
            this.scene.add(post);
        }
    }

    buildPlayers() {
        for (let index = 1; index <= 4; index += 1) {
            const token = this.board.tokens[`player${index}`];
            const team = token.element.classList.contains('team2-player') ? 'team2' : 'team1';
            const group = this.createPlayer(team, token.handedness);
            group.userData.id = token.id;
            group.userData.team = team;
            group.userData.handedness = token.handedness;
            this.scene.add(group);
            this.playerObjects.set(token.id, group);
        }
    }

    createPlayer(team, handedness) {
        const group = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team], roughness: 0.72 });
        const navyMaterial = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.7 });
        const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf0b58a, roughness: 0.82 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.75, 5, 10), bodyMaterial);
        body.position.y = 0.78;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), skinMaterial);
        head.position.y = 1.52;
        group.add(head);
        const legs = [-0.12, 0.12].map(x => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.52, 8), navyMaterial);
            leg.position.set(x, 0.27, 0);
            group.add(leg);
            return leg;
        });
        void legs;
        const paddleSide = handedness === 'right' ? 1 : -1;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.58, 8), skinMaterial);
        arm.rotation.z = paddleSide * -0.45;
        arm.position.set(paddleSide * 0.32, 1.03, 0);
        group.add(arm);
        const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.045), navyMaterial);
        paddle.position.set(paddleSide * 0.5, 0.77, 0);
        paddle.rotation.z = paddleSide * -0.18;
        paddle.userData.side = handedness;
        group.add(paddle);
        group.userData.paddle = paddle;
        group.rotation.y = team === 'team1' ? 0 : Math.PI;
        return group;
    }

    buildBall() {
        const radius = COURT_DIMENSIONS.ballDiameterMeters / 2;
        const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xdfff00, roughness: 0.45 });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), ballMaterial);
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.01, radius * 0.08, 5, 20), new THREE.MeshBasicMaterial({ color: 0x263214 }));
        stripe.rotation.x = Math.PI / 2;
        ball.add(stripe);
        this.scene.add(ball);
        this.ballObject = ball;
    }

    setCamera(name) {
        if (!CAMERA_PRESETS[name] || !this.camera) return false;
        const preset = CAMERA_PRESETS[name];
        this.camera.position.fromArray(preset.position);
        this.camera.lookAt(...preset.target);
        this.cameraPreset = name;
        return true;
    }

    setPlaybackRate(rate) {
        this.clock.setRate(rate);
        this.updateUI();
    }

    togglePlay() {
        if (!this.active) return;
        if (this.clock.elapsed >= this.timeline.duration) this.restart();
        if (this.clock.playing) this.clock.pause();
        else this.clock.play();
        this.updateUI();
    }

    restart() {
        this.clock.pause();
        this.clock.restart();
        this.applyAtTime(0);
        this.updateUI();
    }

    startRenderLoop() {
        if (this.renderLoopId !== null) return;
        this.renderLoopCount += 1;
        const frame = timestamp => {
            if (!this.active) return;
            this.renderLoopId = requestAnimationFrame(frame);
            const elapsed = this.clock.update(timestamp);
            this.applyAtTime(elapsed);
            this.renderer.render(this.scene, this.camera);
            if (elapsed >= this.timeline.duration && this.clock.playing) {
                this.clock.pause();
                this.updateUI();
            }
        };
        this.renderLoopId = requestAnimationFrame(frame);
    }

    applyAtTime(seconds) {
        const initial = this.currentPlay.steps[0].positions;
        if (!this.timeline.segments.length || seconds <= 0) {
            this.applyPlayerPositions(initial, initial, 0);
            const p = boardToWorld(initial.ball, 2.5);
            this.ballObject?.position.set(p.x, p.y, p.z);
            this.lastState = { phase: 'ready', elapsed: 0, bounced: false, ball: p };
            return this.lastState;
        }
        const segment = this.timeline.segments.find(item => seconds <= item.endTime) || this.timeline.segments.at(-1);
        const localTime = Math.max(0, Math.min(segment.duration, seconds - segment.startTime));
        const progress = segment.duration ? localTime / segment.duration : 1;
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        this.applyPlayerPositions(segment.previous.positions, segment.step.positions, eased);
        let ballState;
        if (segment.trajectory) {
            ballState = segment.trajectory.sample(localTime);
            this.ballObject.position.set(ballState.x, ballState.y, ballState.z);
            const rotationsPerSecond = segment.trajectory.metadata.spin.rpm / 60;
            const angle = localTime * rotationsPerSecond * Math.PI * 2;
            this.ballObject.rotation.set(angle, angle * 0.35, 0);
        } else {
            const from = boardToWorld(segment.previous.positions.ball, 1.2);
            const to = boardToWorld(segment.step.positions.ball, 1.2);
            ballState = { x: THREE.MathUtils.lerp(from.x, to.x, eased), y: THREE.MathUtils.lerp(from.y, to.y, eased), z: THREE.MathUtils.lerp(from.z, to.z, eased), phase: 'movement', bounced: false };
            this.ballObject.position.set(ballState.x, ballState.y, ballState.z);
        }
        this.lastState = { ...ballState, elapsed: seconds, stepIndex: segment.index };
        this.elements.status.textContent = `${segment.step.label} · ${ballState.phase}`;
        return this.lastState;
    }

    applyPlayerPositions(fromPositions, toPositions, progress) {
        this.playerObjects.forEach((object, id) => {
            const from = boardToWorld(fromPositions[id]);
            const to = boardToWorld(toPositions[id]);
            object.position.set(
                THREE.MathUtils.lerp(from.x, to.x, progress),
                0,
                THREE.MathUtils.lerp(from.z, to.z, progress)
            );
        });
    }

    resize() {
        if (!this.renderer || !this.camera) return;
        const width = Math.max(1, this.elements.canvas.clientWidth);
        const height = Math.max(1, this.elements.canvas.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    updateUI() {
        if (!this.currentPlay) return;
        this.elements.title.textContent = `${this.currentPlay.name} · 3D`;
        this.elements.playPause.textContent = this.clock.playing ? 'Pause' : this.clock.elapsed >= this.timeline.duration ? 'Replay' : 'Play';
        this.elements.playPause.setAttribute('aria-pressed', String(this.clock.playing));
        if (!this.clock.playing && this.clock.elapsed === 0) this.elements.status.textContent = 'Ready';
    }

    getState() {
        return {
            active: this.active,
            playing: this.clock.playing,
            elapsed: this.clock.elapsed,
            playbackRate: this.clock.playbackRate,
            camera: this.cameraPreset,
            playId: this.currentPlay?.id || null,
            playerCount: this.playerObjects.size,
            hasBall: Boolean(this.ballObject),
            renderLoopCount: this.renderLoopCount,
            lastState: this.lastState
        };
    }

    exit() {
        if (!this.active) return false;
        this.clock.pause();
        this.active = false;
        if (this.renderLoopId !== null) cancelAnimationFrame(this.renderLoopId);
        this.renderLoopId = null;
        window.removeEventListener('resize', this.boundResize);
        this.scene.traverse(object => {
            object.geometry?.dispose?.();
            if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
            else object.material?.dispose?.();
        });
        this.renderer.dispose();
        this.renderer.forceContextLoss?.();
        this.elements.canvas.replaceChildren();
        this.elements.root.hidden = true;
        document.body.classList.remove('three-d-active');
        this.playerObjects.clear();
        this.ballObject = null;
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.currentPlay = null;
        this.timeline = null;
        this.board.plays.updateUI();
        return true;
    }
}

function initialize() {
    if (!window.pickleboard?.plays) return;
    const viewer = new ThreeDPlaybackViewer(window.pickleboard);
    window.pickleboard.threeD = viewer;
    const originalUpdateUI = window.pickleboard.plays.updateUI.bind(window.pickleboard.plays);
    window.pickleboard.plays.updateUI = (...args) => {
        const result = originalUpdateUI(...args);
        viewer.updateEntryAvailability();
        return result;
    };
    viewer.updateEntryAvailability();
}

if (window.pickleboard?.plays) initialize();
else window.addEventListener('pickleboard:ready', initialize, { once: true });

export { ThreeDPlaybackViewer };
