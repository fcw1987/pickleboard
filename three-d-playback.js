import * as THREE from './vendor/three.module.min.js';
import {
    CAMERA_PRESETS,
    COURT_DIMENSIONS,
    FEET_TO_METERS,
    PlaybackClock,
    boardToWorld,
    compilePlayTimeline
} from './three-d-core.js';
import {
    POSE_LIBRARY,
    captureRigRest,
    dominantAliases,
    sampleStrokePose
} from './three-d-animation.js';

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
            previous: document.getElementById('threeDPrevious'),
            playPause: document.getElementById('threeDPlayPause'),
            next: document.getElementById('threeDNext'),
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
        this.elements.previous.addEventListener('click', () => this.previous());
        this.elements.playPause.addEventListener('click', () => this.togglePlay());
        this.elements.next.addEventListener('click', () => this.next());
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

        this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x173326, 1.75));
        const key = new THREE.DirectionalLight(0xfff4dc, 2.2);
        key.position.set(-6, 9, -5);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0x9fc7ff, 0.7);
        fill.position.set(5, 4, 7);
        this.scene.add(fill);
        this.buildCourt();
        this.buildPlayers();
        this.buildBall();
        this.resize();
    }

    buildCourt() {
        const width = COURT_DIMENSIONS.widthFeet * FEET_TO_METERS;
        const length = COURT_DIMENSIONS.lengthFeet * FEET_TO_METERS;
        const courtGroup = new THREE.Group();
        courtGroup.name = 'Court';
        courtGroup.userData = { width, length, kitchenDepth: COURT_DIMENSIONS.kitchenDepthFeet * FEET_TO_METERS };
        this.scene.add(courtGroup);

        const surround = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 10, length + 10),
            new THREE.MeshStandardMaterial({ color: 0x183b2b, roughness: 1 })
        );
        surround.name = 'CourtSurround';
        surround.rotation.x = -Math.PI / 2;
        surround.position.y = -0.075;
        courtGroup.add(surround);

        const slab = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.11, length),
            new THREE.MeshStandardMaterial({ color: 0x315f48, roughness: 0.88, metalness: 0.02 })
        );
        slab.name = 'CourtSlab';
        slab.position.y = -0.055;
        courtGroup.add(slab);

        const kitchen = new THREE.Mesh(
            new THREE.PlaneGeometry(width - 0.04, 14 * FEET_TO_METERS),
            new THREE.MeshStandardMaterial({ color: 0x65756e, roughness: 0.95 })
        );
        kitchen.name = 'KitchenSurface';
        kitchen.rotation.x = -Math.PI / 2;
        kitchen.position.y = 0.004;
        courtGroup.add(kitchen);

        const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
        const lineWidth = 0.045;
        const addLine = (name, x, z, w, d) => {
            const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), lineMaterial);
            line.name = name;
            line.position.set(x, 0.018, z);
            courtGroup.add(line);
        };
        addLine('GreenBaseline', 0, -length / 2, width, lineWidth);
        addLine('OrangeBaseline', 0, length / 2, width, lineWidth);
        addLine('LeftSideline', -width / 2, 0, lineWidth, length);
        addLine('RightSideline', width / 2, 0, lineWidth, length);
        const kitchenZ = 7 * FEET_TO_METERS;
        addLine('GreenKitchenLine', 0, -kitchenZ, width, lineWidth);
        addLine('OrangeKitchenLine', 0, kitchenZ, width, lineWidth);
        addLine('GreenCenterline', 0, -(length / 2 - 7 * FEET_TO_METERS) / 2, lineWidth, 15 * FEET_TO_METERS);
        addLine('OrangeCenterline', 0, (length / 2 - 7 * FEET_TO_METERS) / 2, lineWidth, 15 * FEET_TO_METERS);

        const centerHeight = COURT_DIMENSIONS.netCenterHeightFeet * FEET_TO_METERS;
        const sideHeight = COURT_DIMENSIONS.netSidelineHeightFeet * FEET_TO_METERS;
        const netWidth = width + 0.55;
        const netGroup = new THREE.Group();
        netGroup.name = 'Net';
        netGroup.userData = { centerHeight, sideHeight, width: netWidth };
        courtGroup.add(netGroup);

        const netMaterial = new THREE.LineBasicMaterial({ color: 0xd9e2e5, transparent: true, opacity: 0.52 });
        const points = [];
        const segments = 16;
        const heightAt = x => centerHeight + (sideHeight - centerHeight) * Math.pow(Math.abs(x) / (netWidth / 2), 1.7);
        for (let index = 0; index <= segments; index += 1) {
            const x = -netWidth / 2 + (netWidth * index / segments);
            points.push(x, 0.03, 0, x, heightAt(x), 0);
        }
        for (let row = 1; row < 7; row += 1) {
            for (let index = 0; index < segments; index += 1) {
                const x1 = -netWidth / 2 + netWidth * index / segments;
                const x2 = -netWidth / 2 + netWidth * (index + 1) / segments;
                const ratio = row / 7;
                points.push(x1, heightAt(x1) * ratio, 0, x2, heightAt(x2) * ratio, 0);
            }
        }
        const netGeometry = new THREE.BufferGeometry();
        netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const net = new THREE.LineSegments(netGeometry, netMaterial);
        net.name = 'NetMesh';
        netGroup.add(net);

        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-netWidth / 2, sideHeight, 0),
            new THREE.Vector3(0, centerHeight - 0.025, 0),
            new THREE.Vector3(netWidth / 2, sideHeight, 0)
        );
        const tape = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 24, 0.028, 6, false),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })
        );
        tape.name = 'NetTopTape';
        netGroup.add(tape);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.5 });
        for (const x of [-netWidth / 2, netWidth / 2]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, sideHeight + 0.12, 12), postMaterial);
            post.name = 'NetPost';
            post.position.set(x, (sideHeight + 0.12) / 2, 0);
            netGroup.add(post);
        }
        this.courtObject = courtGroup;
        this.netObject = netGroup;
    }

    buildPlayers() {
        for (let index = 1; index <= 4; index += 1) {
            const token = this.board.tokens[`player${index}`];
            const team = token.element.classList.contains('team2-player') ? 'team2' : 'team1';
            const group = this.createPlayer(team, token.handedness);
            group.userData.id = token.id;
            group.userData.team = team;
            group.userData.handedness = token.handedness;
            group.userData.restPose = captureRigRest(group.userData.nodes);
            group.userData.aliases = dominantAliases(token.handedness);
            group.userData.animation = { pose: 'ready', phase: 'ready', stroke: null, planted: false, locomotion: false };
            this.scene.add(group);
            this.playerObjects.set(token.id, group);
        }
    }

    createPlayer(team, handedness) {
        const root = new THREE.Group();
        root.name = 'PlayerRoot';
        root.scale.setScalar(0.92);
        const accent = TEAM_COLORS[team];
        const navyMaterial = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.72 });
        const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.68 });
        const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf0b58a, roughness: 0.82 });
        const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f5f7, roughness: 0.7 });
        const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x0d172d, roughness: 0.58 });
        const nodes = {};
        const register = (name, object, parent = root) => {
            object.name = name;
            parent.add(object);
            nodes[name] = object;
            return object;
        };
        const mesh = (geometry, material) => new THREE.Mesh(geometry, material);

        const shadow = mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: 0x07130d, transparent: true, opacity: 0.34, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.006;
        register('ContactShadow', shadow);

        const hips = register('Hips', new THREE.Group());
        hips.position.y = 0.79;
        const pelvis = mesh(new THREE.BoxGeometry(0.38, 0.22, 0.24), navyMaterial);
        pelvis.rotation.x = -0.12;
        register('Pelvis', pelvis, hips);

        const torso = register('Torso', new THREE.Group(), hips);
        torso.position.set(0, 0.37, 0.055);
        torso.rotation.x = -0.13;
        const hoodie = mesh(new THREE.CapsuleGeometry(0.27, 0.45, 5, 10), navyMaterial);
        register('HoodieBody', hoodie, torso);
        const chestAccent = mesh(new THREE.BoxGeometry(0.3, 0.09, 0.025), accentMaterial);
        chestAccent.position.set(0, 0.08, -0.27);
        register('ChestAccent', chestAccent, torso);
        const pouch = mesh(new THREE.BoxGeometry(0.25, 0.12, 0.06), navyMaterial);
        pouch.position.set(0, -0.19, -0.27);
        register('HoodiePouch', pouch, torso);
        const hood = mesh(new THREE.TorusGeometry(0.19, 0.055, 6, 14, Math.PI), navyMaterial);
        hood.rotation.set(Math.PI / 2, 0, Math.PI);
        hood.position.set(0, 0.29, 0.12);
        register('Hood', hood, torso);

        const neck = mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 8), skinMaterial);
        neck.position.y = 0.37;
        register('Neck', neck, torso);
        const headGroup = register('Head', new THREE.Group(), torso);
        headGroup.position.set(0, 0.55, 0.01);
        const head = mesh(new THREE.SphereGeometry(0.18, 16, 12), skinMaterial);
        head.scale.set(0.9, 1.08, 0.9);
        register('HeadMesh', head, headGroup);
        const capCrown = mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMaterial);
        capCrown.position.y = 0.09;
        register('CapCrown', capCrown, headGroup);
        const capBrim = mesh(new THREE.BoxGeometry(0.24, 0.025, 0.16), accentMaterial);
        capBrim.position.set(0, 0.08, -0.17);
        register('CapBrim', capBrim, headGroup);

        const makeLeg = (side, x) => {
            const leg = register(`${side}Leg`, new THREE.Group(), hips);
            leg.position.set(x, -0.1, 0);
            leg.rotation.z = side === 'Left' ? 0.12 : -0.12;
            const thigh = mesh(new THREE.CapsuleGeometry(0.085, 0.33, 4, 8), navyMaterial);
            thigh.position.y = -0.23;
            thigh.rotation.z = side === 'Left' ? -0.12 : 0.12;
            register(`${side}Thigh`, thigh, leg);
            const knee = register(`${side}Knee`, new THREE.Group(), leg);
            knee.position.set(side === 'Left' ? 0.025 : -0.025, -0.47, -0.025);
            knee.rotation.x = 0.35;
            const lower = mesh(new THREE.CapsuleGeometry(0.065, 0.27, 4, 8), skinMaterial);
            lower.position.set(0, -0.2, -0.055);
            register(`${side}LowerLeg`, lower, knee);
            const foot = mesh(new THREE.BoxGeometry(0.16, 0.09, 0.31), shoeMaterial);
            foot.position.set(0, -0.4, -0.16);
            register(`${side}Foot`, foot, knee);
        };
        makeLeg('Left', -0.16);
        makeLeg('Right', 0.16);

        const makeArm = (side, x) => {
            const arm = register(`${side}Arm`, new THREE.Group(), torso);
            arm.position.set(x, 0.18, -0.04);
            arm.rotation.z = side === 'Left' ? 0.42 : -0.42;
            arm.rotation.x = -0.25;
            const upper = mesh(new THREE.CapsuleGeometry(0.055, 0.27, 4, 8), navyMaterial);
            upper.position.y = -0.18;
            register(`${side}UpperArm`, upper, arm);
            const elbow = register(`${side}Elbow`, new THREE.Group(), arm);
            elbow.position.set(0, -0.38, -0.02);
            elbow.rotation.x = -0.68;
            elbow.rotation.z = side === 'Left' ? -0.12 : 0.12;
            const forearm = mesh(new THREE.CapsuleGeometry(0.045, 0.23, 4, 8), skinMaterial);
            forearm.position.set(0, -0.15, -0.08);
            register(`${side}Forearm`, forearm, elbow);
            const hand = register(`${side}Hand`, new THREE.Group(), elbow);
            hand.position.set(0, -0.31, -0.16);
            const handMesh = mesh(new THREE.SphereGeometry(0.065, 10, 8), skinMaterial);
            register(`${side}HandMesh`, handMesh, hand);
            return hand;
        };
        const leftHand = makeArm('Left', -0.29);
        const rightHand = makeArm('Right', 0.29);
        const paddleHand = handedness === 'right' ? rightHand : leftHand;
        const paddleAssembly = register('PaddleAttachment', new THREE.Group(), paddleHand);
        paddleAssembly.rotation.set(-0.25, 0, handedness === 'right' ? -0.14 : 0.14);
        const handle = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.27, 8), darkMaterial);
        handle.position.y = -0.1;
        register('PaddleHandle', handle, paddleAssembly);
        const grip = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.15, 8), new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.9 }));
        grip.position.y = -0.15;
        register('PaddleGrip', grip, paddleAssembly);
        const face = mesh(new THREE.CapsuleGeometry(0.16, 0.22, 5, 10), darkMaterial);
        face.scale.z = 0.12;
        face.position.y = -0.38;
        register('PaddleFace', face, paddleAssembly);
        const trim = mesh(new THREE.TorusGeometry(0.17, 0.015, 5, 16), accentMaterial);
        trim.scale.set(1, 1.45, 0.22);
        trim.position.y = -0.38;
        register('PaddleTrim', trim, paddleAssembly);

        paddleAssembly.userData.side = handedness;
        root.userData.nodes = nodes;
        root.userData.paddle = paddleAssembly;
        root.userData.paddleHand = handedness === 'right' ? 'RightHand' : 'LeftHand';
        root.userData.groundY = 0;
        // The procedural model faces local -Z; Green looks toward +Z/Orange and Orange toward -Z/Green.
        root.rotation.y = team === 'team1' ? Math.PI : 0;
        return root;
    }

    resolvePoseChannels(root, poseName) {
        const pose = POSE_LIBRARY[poseName] || POSE_LIBRARY.ready;
        const aliases = root.userData.aliases;
        return Object.fromEntries(Object.entries(pose).map(([role, value]) => [aliases[role] || role, value]));
    }

    applyPose(root, fromName, toName, progress) {
        const rest = root.userData.restPose;
        const from = this.resolvePoseChannels(root, fromName);
        const to = this.resolvePoseChannels(root, toName);
        const t = THREE.MathUtils.smoothstep(Math.max(0, Math.min(1, progress)), 0, 1);
        Object.entries(root.userData.nodes).forEach(([name, node]) => {
            const base = rest[name];
            if (!base) return;
            const fromChannel = from[name] || {};
            const toChannel = to[name] || {};
            const fromRotation = fromChannel.rotation || { x: 0, y: 0, z: 0 };
            const toRotation = toChannel.rotation || { x: 0, y: 0, z: 0 };
            node.rotation.set(
                base.rotation.x + THREE.MathUtils.lerp(fromRotation.x, toRotation.x, t),
                base.rotation.y + THREE.MathUtils.lerp(fromRotation.y, toRotation.y, t),
                base.rotation.z + THREE.MathUtils.lerp(fromRotation.z, toRotation.z, t)
            );
            const fromPosition = fromChannel.position || { x: 0, y: 0, z: 0 };
            const toPosition = toChannel.position || { x: 0, y: 0, z: 0 };
            node.position.set(
                base.position.x + THREE.MathUtils.lerp(fromPosition.x, toPosition.x, t),
                base.position.y + THREE.MathUtils.lerp(fromPosition.y, toPosition.y, t),
                base.position.z + THREE.MathUtils.lerp(fromPosition.z, toPosition.z, t)
            );
        });
        root.userData.animation.pose = toName;
    }

    resetPlayerPoses() {
        this.playerObjects.forEach(root => {
            this.applyPose(root, 'ready', 'ready', 1);
            root.userData.animation = { pose: 'ready', phase: 'ready', stroke: null, planted: false, locomotion: false };
        });
    }

    applyLocomotion(root, progress, distance) {
        if (distance < 0.06) return;
        const phase = progress * Math.max(1, distance / 0.5) * Math.PI * 2;
        const nodes = root.userData.nodes;
        const rest = root.userData.restPose;
        const swing = Math.sin(phase) * Math.min(0.24, distance * 0.06);
        nodes.LeftLeg.rotation.x = rest.LeftLeg.rotation.x + swing;
        nodes.RightLeg.rotation.x = rest.RightLeg.rotation.x - swing;
        nodes.LeftArm.rotation.x = rest.LeftArm.rotation.x - swing * 0.35;
        nodes.RightArm.rotation.x = rest.RightArm.rotation.x + swing * 0.35;
        nodes.Hips.position.y = rest.Hips.position.y + Math.abs(Math.sin(phase)) * 0.025;
        root.userData.animation.locomotion = true;
    }

    applySegmentAnimations(segment, localTime, progress) {
        this.resetPlayerPoses();
        const semantics = segment.shotSemantics;
        this.playerObjects.forEach((root, id) => {
            const from = segment.previous.positions[id];
            const to = segment.step.positions[id];
            const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) * FEET_TO_METERS : 0;
            const isStriker = semantics?.playerId === id;
            if (isStriker) {
                const plantStart = Math.max(0, segment.contactTime - semantics.profile.duration * 0.13);
                const movementProgress = segment.contactTime ? Math.min(1, localTime / plantStart) : progress;
                const planted = localTime >= plantStart && localTime <= segment.contactTime + 0.12;
                root.userData.animation.planted = planted;
                root.userData.animation.locomotion = false;
                const strokeTime = Math.max(0, Math.min(semantics.profile.duration, localTime));
                const sample = sampleStrokePose(semantics.stroke, semantics.profile, strokeTime);
                this.applyPose(root, sample.from, sample.to, sample.progress);
                root.userData.animation.phase = sample.phase;
                root.userData.animation.stroke = semantics.stroke;
                root.userData.animation.contactTime = segment.contactTime;
                root.userData.animation.movementProgress = movementProgress;
            } else {
                if (segment.step.shot && localTime < segment.contactTime && distance < 0.25) {
                    const splitProgress = Math.sin(Math.PI * Math.min(1, localTime / segment.contactTime));
                    this.applyPose(root, 'ready', 'split-step', splitProgress);
                    root.userData.animation.phase = 'split-step';
                }
                this.applyLocomotion(root, progress, distance);
            }
        });
    }

    segmentEndpointTime(index) {
        if (index <= 0) return 0;
        return this.timeline.segments[Math.min(index - 1, this.timeline.segments.length - 1)].endTime;
    }

    currentStepIndex() {
        if (!this.timeline || this.clock.elapsed <= 0) return 0;
        const index = this.timeline.segments.findIndex(segment => this.clock.elapsed <= segment.endTime);
        return index < 0 ? this.currentPlay.steps.length - 1 : this.timeline.segments[index].index;
    }

    previous() {
        if (!this.active) return false;
        this.clock.pause();
        const target = Math.max(0, this.currentStepIndex() - 1);
        this.clock.elapsed = this.segmentEndpointTime(target);
        this.applyAtTime(this.clock.elapsed);
        this.updateUI();
        return true;
    }

    next() {
        if (!this.active) return false;
        this.clock.pause();
        const target = Math.min(this.currentPlay.steps.length - 1, this.currentStepIndex() + 1);
        this.clock.elapsed = this.segmentEndpointTime(target);
        this.applyAtTime(this.clock.elapsed);
        this.updateUI();
        return true;
    }

    buildBall() {
        const radius = COURT_DIMENSIONS.ballDiameterMeters / 2;
        const visualRadius = radius * 1.16;
        const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xeaff16, emissive: 0x5b6800, emissiveIntensity: 0.42, roughness: 0.38 });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(visualRadius, 18, 12), ballMaterial);
        ball.userData = { physicalRadius: radius, visualRadius };
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(visualRadius * 1.01, visualRadius * 0.075, 5, 20), new THREE.MeshBasicMaterial({ color: 0x263214 }));
        stripe.rotation.x = Math.PI / 2;
        ball.add(stripe);
        this.scene.add(ball);
        this.ballObject = ball;
    }

    setCamera(name) {
        if (!CAMERA_PRESETS[name] || !this.camera) return false;
        const preset = CAMERA_PRESETS[name];
        this.camera.position.fromArray(preset.position);
        this.camera.fov = preset.fov;
        this.camera.updateProjectionMatrix();
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
            this.resetPlayerPoses();
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
        this.applySegmentAnimations(segment, localTime, eased);
        this.applyPlayerPositions(segment.previous.positions, segment.step.positions, eased, segment, localTime);
        let ballState;
        if (segment.trajectory) {
            const trajectoryTime = Math.max(0, localTime - segment.trajectoryStartTime);
            if (localTime + 1e-9 < segment.contactTime) {
                const start = segment.trajectory.start;
                ballState = { ...start, phase: 'waiting-contact', bounced: false, launched: false };
            } else {
                ballState = { ...segment.trajectory.sample(trajectoryTime), launched: true };
            }
            if (localTime + 1e-9 >= segment.contactTime && localTime <= segment.contactTime + 1e-9 && segment.shotSemantics) {
                const actor = this.playerObjects.get(segment.shotSemantics.playerId);
                actor.updateMatrixWorld(true);
                actor.userData.paddle.getWorldPosition(this.ballObject.position);
                ballState = { x: this.ballObject.position.x, y: this.ballObject.position.y, z: this.ballObject.position.z, phase: 'contact', bounced: false, launched: localTime + 1e-9 >= segment.contactTime };
            } else {
                this.ballObject.position.set(ballState.x, ballState.y, ballState.z);
            }
            const rotationsPerSecond = segment.trajectory.metadata.spin.rpm / 60;
            const angle = trajectoryTime * rotationsPerSecond * Math.PI * 2;
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

    applyPlayerPositions(fromPositions, toPositions, progress, segment = null, localTime = 0) {
        this.playerObjects.forEach((object, id) => {
            const from = boardToWorld(fromPositions[id]);
            const to = boardToWorld(toPositions[id]);
            let movementProgress = progress;
            if (segment?.shotSemantics?.playerId === id) {
                const plantStart = Math.max(0.05, segment.contactTime - segment.shotSemantics.profile.duration * 0.13);
                movementProgress = localTime >= plantStart ? 1 : Math.min(1, localTime / plantStart);
            }
            object.position.set(
                THREE.MathUtils.lerp(from.x, to.x, movementProgress),
                0,
                THREE.MathUtils.lerp(from.z, to.z, movementProgress)
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
        const stepIndex = this.currentStepIndex();
        this.elements.previous.disabled = this.clock.playing || stepIndex === 0;
        this.elements.next.disabled = this.clock.playing || stepIndex >= this.currentPlay.steps.length - 1;
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
