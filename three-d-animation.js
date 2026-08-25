// Renderer-independent authored poses for the procedural Pickleboard rig.

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
const channel = (rotation = vec(), position = null) => ({ rotation, position });

export const REQUIRED_POSES = Object.freeze([
    'ready', 'split-step', 'serve-prepare', 'serve-contact', 'serve-follow',
    'forehand-prepare', 'forehand-contact', 'forehand-follow',
    'backhand-prepare', 'backhand-contact', 'backhand-follow',
    'drop-contact', 'block-contact'
]);

export const POSE_LIBRARY = Object.freeze({
    ready: {
        Hips: channel(vec(-0.08, 0, 0)), Torso: channel(vec(-0.13, 0, 0)),
        dominantArm: channel(vec(-0.25, 0, -0.38)), dominantElbow: channel(vec(-0.55, 0, 0.08)),
        nonDominantArm: channel(vec(-0.2, 0, 0.28)), nonDominantElbow: channel(vec(-0.5, 0, -0.06)),
        LeftKnee: channel(vec(0.3, 0, 0)), RightKnee: channel(vec(0.3, 0, 0))
    },
    'split-step': {
        Hips: channel(vec(-0.12, 0, 0), vec(0, -0.07, 0)), Torso: channel(vec(-0.18, 0, 0)),
        LeftLeg: channel(vec(0, 0, 0.18)), RightLeg: channel(vec(0, 0, -0.18)),
        LeftKnee: channel(vec(0.52, 0, 0)), RightKnee: channel(vec(0.52, 0, 0))
    },
    'serve-prepare': {
        Hips: channel(vec(-0.05, -0.3, 0)), Torso: channel(vec(-0.12, -0.45, 0.04)),
        dominantArm: channel(vec(-0.25, -0.2, -1.05)), dominantElbow: channel(vec(-0.25, 0, 0.15)),
        nonDominantArm: channel(vec(-0.5, 0.2, 0.55)), nonDominantElbow: channel(vec(-0.25, 0, -0.1)),
        dominantKnee: channel(vec(0.48, 0, 0)), nonDominantKnee: channel(vec(0.3, 0, 0))
    },
    'serve-contact': {
        Hips: channel(vec(-0.03, 0.28, 0)), Torso: channel(vec(-0.08, 0.52, -0.05)),
        dominantArm: channel(vec(-0.7, 0.15, 0.3)), dominantElbow: channel(vec(-0.12, 0, 0)),
        nonDominantArm: channel(vec(-0.25, 0, -0.2)), dominantKnee: channel(vec(0.18, 0, 0))
    },
    'serve-follow': {
        Hips: channel(vec(-0.06, 0.42, 0)), Torso: channel(vec(-0.16, 0.65, -0.08)),
        dominantArm: channel(vec(-0.65, 0.4, 0.85)), dominantElbow: channel(vec(-0.3, 0, 0.1))
    },
    'forehand-prepare': {
        Hips: channel(vec(-0.08, -0.32, 0)), Torso: channel(vec(-0.14, -0.5, 0)),
        dominantArm: channel(vec(-0.25, 0.08, -1.1)), dominantElbow: channel(vec(-0.48, 0, 0.12)),
        nonDominantArm: channel(vec(-0.2, 0, 0.3)), dominantKnee: channel(vec(0.42, 0, 0))
    },
    'forehand-contact': {
        Hips: channel(vec(-0.06, 0.2, 0)), Torso: channel(vec(-0.12, 0.38, 0)),
        dominantArm: channel(vec(-0.5, 0.15, 0.12)), dominantElbow: channel(vec(-0.2, 0, 0.04)),
        dominantKnee: channel(vec(0.24, 0, 0))
    },
    'forehand-follow': {
        Hips: channel(vec(-0.08, 0.38, 0)), Torso: channel(vec(-0.16, 0.58, -0.05)),
        dominantArm: channel(vec(-0.65, 0.25, 0.85)), dominantElbow: channel(vec(-0.42, 0, 0.08))
    },
    'backhand-prepare': {
        Hips: channel(vec(-0.08, 0.28, 0)), Torso: channel(vec(-0.14, 0.42, 0)),
        dominantArm: channel(vec(-0.3, 0.05, 0.72)), dominantElbow: channel(vec(-0.4, 0, -0.08)),
        nonDominantArm: channel(vec(-0.25, 0, -0.42))
    },
    'backhand-contact': {
        Hips: channel(vec(-0.06, -0.12, 0)), Torso: channel(vec(-0.1, -0.28, 0)),
        dominantArm: channel(vec(-0.48, 0.05, -0.05)), dominantElbow: channel(vec(-0.16, 0, 0))
    },
    'backhand-follow': {
        Hips: channel(vec(-0.08, -0.34, 0)), Torso: channel(vec(-0.15, -0.48, 0)),
        dominantArm: channel(vec(-0.58, 0.15, -0.78)), dominantElbow: channel(vec(-0.35, 0, -0.05))
    },
    'drop-contact': {
        Torso: channel(vec(-0.2, 0.12, 0)), dominantArm: channel(vec(-0.35, 0.05, -0.08)),
        dominantElbow: channel(vec(-0.48, 0, 0.02)), dominantKnee: channel(vec(0.42, 0, 0)),
        nonDominantKnee: channel(vec(0.4, 0, 0))
    },
    'block-contact': {
        Torso: channel(vec(-0.12, 0, 0)), dominantArm: channel(vec(-0.42, 0, 0.02)),
        dominantElbow: channel(vec(-0.55, 0, 0)), nonDominantArm: channel(vec(-0.3, 0, -0.05)),
        LeftKnee: channel(vec(0.38, 0, 0)), RightKnee: channel(vec(0.38, 0, 0))
    }
});

export function dominantAliases(handedness) {
    const right = handedness === 'right';
    return {
        dominantArm: right ? 'RightArm' : 'LeftArm',
        dominantElbow: right ? 'RightElbow' : 'LeftElbow',
        dominantHand: right ? 'RightHand' : 'LeftHand',
        dominantKnee: right ? 'RightKnee' : 'LeftKnee',
        nonDominantArm: right ? 'LeftArm' : 'RightArm',
        nonDominantElbow: right ? 'LeftElbow' : 'RightElbow',
        nonDominantHand: right ? 'LeftHand' : 'RightHand',
        nonDominantKnee: right ? 'LeftKnee' : 'RightKnee'
    };
}

const strokePoseNames = stroke => {
    if (stroke === 'serve') return ['serve-prepare', 'serve-contact', 'serve-follow'];
    if (stroke === 'backhand') return ['backhand-prepare', 'backhand-contact', 'backhand-follow'];
    if (stroke === 'drop') return ['forehand-prepare', 'drop-contact', 'ready'];
    if (stroke === 'block') return ['ready', 'block-contact', 'ready'];
    return ['forehand-prepare', 'forehand-contact', 'forehand-follow'];
};

export function sampleStrokePose(stroke, profile, localTime) {
    const [prepare, contact, follow] = strokePoseNames(stroke);
    const duration = profile.duration;
    const normalized = Math.max(0, Math.min(1, localTime / duration));
    const contactRatio = profile.contactRatio;
    const prepareRatio = profile.prepareRatio;
    const recoverRatio = profile.recoverRatio;
    const epsilon = 1e-9;
    if (normalized <= prepareRatio + epsilon) return { from: 'ready', to: prepare, progress: normalized / prepareRatio, phase: 'prepare' };
    if (normalized <= contactRatio + epsilon) return { from: prepare, to: contact, progress: (normalized - prepareRatio) / (contactRatio - prepareRatio), phase: 'contact' };
    if (normalized <= recoverRatio + epsilon) return { from: contact, to: follow, progress: (normalized - contactRatio) / (recoverRatio - contactRatio), phase: 'follow-through' };
    return { from: follow, to: 'ready', progress: (normalized - recoverRatio) / (1 - recoverRatio), phase: 'recover' };
}

export function captureRigRest(nodes) {
    return Object.fromEntries(Object.entries(nodes).map(([name, node]) => [name, {
        position: { x: node.position.x, y: node.position.y, z: node.position.z },
        rotation: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z }
    }]));
}
