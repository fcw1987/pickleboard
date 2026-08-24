// Pure, renderer-independent foundations for Pickleboard 3D playback.

export const FEET_TO_METERS = 0.3048;
export const COURT_DIMENSIONS = Object.freeze({
    widthFeet: 20,
    lengthFeet: 44,
    kitchenDepthFeet: 7,
    netCenterHeightFeet: 34 / 12,
    netSidelineHeightFeet: 36 / 12,
    ballDiameterMeters: 0.074
});

export const CAMERA_PRESETS = Object.freeze({
    overhead: { label: 'Overhead 3D', position: [0, 13.5, 9.5], target: [0, 0, 0] },
    sideline: { label: 'Sideline', position: [10.5, 4.5, 0], target: [0, 0.8, 0] },
    'behind-green': { label: 'Behind Green', position: [0, 4.2, -11.5], target: [0, 0.9, 1.5] },
    'behind-orange': { label: 'Behind Orange', position: [0, 4.2, 11.5], target: [0, 0.9, -1.5] }
});

export function boardToWorld(point, heightFeet = 0) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(heightFeet)) {
        throw new TypeError('Board and height coordinates must be finite numbers.');
    }
    return {
        x: (point.x - COURT_DIMENSIONS.widthFeet / 2) * FEET_TO_METERS,
        y: heightFeet * FEET_TO_METERS,
        z: (point.y - COURT_DIMENSIONS.lengthFeet / 2) * FEET_TO_METERS
    };
}

const SHOT_DEFAULTS = Object.freeze({
    serve: { speedMph: 28, apexFeet: 7, netClearanceInches: 24, spin: { type: 'topspin', rpm: 650 } },
    return: { speedMph: 30, apexFeet: 7.5, netClearanceInches: 24, spin: { type: 'topspin', rpm: 700 } },
    drop: { speedMph: 18, apexFeet: 7.5, netClearanceInches: 16, spin: { type: 'backspin', rpm: 550 } },
    drive: { speedMph: 38, apexFeet: 5.75, netClearanceInches: 8, spin: { type: 'topspin', rpm: 950 } },
    block: { speedMph: 16, apexFeet: 4.75, netClearanceInches: 10, spin: { type: 'backspin', rpm: 350 } },
    flat: { speedMph: 24, apexFeet: 6, netClearanceInches: 14, spin: { type: 'flat', rpm: 250 } }
});

export function normalizeShotMetadata(shot = {}) {
    if (!shot.from || !shot.to) throw new TypeError('A 3D shot requires finite from and to points.');
    boardToWorld(shot.from);
    boardToWorld(shot.to);
    const type = SHOT_DEFAULTS[shot.type] ? shot.type : 'flat';
    const defaults = SHOT_DEFAULTS[type];
    const trajectory = shot.trajectory3d || {};
    const spin = trajectory.spin || shot.spin || defaults.spin;
    const normalized = {
        type,
        from: { ...shot.from },
        to: { ...shot.to },
        speedMph: trajectory.speedMph ?? defaults.speedMph,
        apexFeet: trajectory.apexFeet ?? defaults.apexFeet,
        netClearanceInches: trajectory.netClearanceInches ?? defaults.netClearanceInches,
        contactHeightFeet: trajectory.contactHeightFeet ?? 2.5,
        spin: {
            type: ['topspin', 'backspin', 'flat'].includes(spin.type) ? spin.type : 'flat',
            rpm: Number.isFinite(spin.rpm) ? Math.max(0, spin.rpm) : 0
        },
        bounce: {
            enabled: trajectory.bounce?.enabled ?? shot.bounce?.enabled ?? true,
            heightFeet: trajectory.bounce?.heightFeet ?? shot.bounce?.heightFeet ?? 1.1
        }
    };
    for (const key of ['speedMph', 'apexFeet', 'netClearanceInches', 'contactHeightFeet']) {
        if (!Number.isFinite(normalized[key]) || normalized[key] < 0) throw new TypeError(`Invalid shot ${key}.`);
    }
    if (normalized.speedMph <= 0) throw new RangeError('Shot speed must be greater than zero.');
    return normalized;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function horizontalDistanceFeet(from, to) {
    return Math.hypot(to.x - from.x, to.y - from.y);
}

export function createTrajectory(shot) {
    const metadata = normalizeShotMetadata(shot);
    const start = boardToWorld(metadata.from, metadata.contactHeightFeet);
    const landing = boardToWorld(metadata.to, COURT_DIMENSIONS.ballDiameterMeters / FEET_TO_METERS / 2);
    const mphToFeetPerSecond = 1.4666667;
    const flightDuration = Math.max(0.55, Math.min(3, horizontalDistanceFeet(metadata.from, metadata.to) /
        (metadata.speedMph * mphToFeetPerSecond)));
    const bounceDuration = metadata.bounce.enabled ? 0.42 : 0;
    const totalDuration = flightDuration + bounceDuration;
    const netHeightFeet = COURT_DIMENSIONS.netCenterHeightFeet;
    const requiredCrossingFeet = netHeightFeet + metadata.netClearanceInches / 12;
    const crossesNet = (metadata.from.y - 22) * (metadata.to.y - 22) < 0;
    if (crossesNet && metadata.apexFeet < requiredCrossingFeet) {
        throw new RangeError(`Shot apex ${metadata.apexFeet}ft cannot provide ${metadata.netClearanceInches}in net clearance.`);
    }

    const spinKick = metadata.spin.type === 'topspin' ? 1.22 : metadata.spin.type === 'backspin' ? 0.55 : 0.9;
    const directionLength = Math.hypot(landing.x - start.x, landing.z - start.z) || 1;
    const bounceEnd = {
        x: landing.x + ((landing.x - start.x) / directionLength) * 0.85 * spinKick,
        y: landing.y,
        z: landing.z + ((landing.z - start.z) / directionLength) * 0.85 * spinKick
    };

    function flightPoint(progress) {
        const t = Math.max(0, Math.min(1, progress));
        const baseline = lerp(start.y, landing.y, t);
        const arcMeters = Math.max(0, metadata.apexFeet * FEET_TO_METERS - Math.max(start.y, landing.y));
        return {
            x: lerp(start.x, landing.x, t),
            y: baseline + Math.sin(Math.PI * t) * arcMeters,
            z: lerp(start.z, landing.z, t)
        };
    }

    function sample(seconds) {
        const time = Math.max(0, Math.min(totalDuration, seconds));
        if (time <= flightDuration || bounceDuration === 0) {
            const progress = flightDuration === 0 ? 1 : time / flightDuration;
            return { ...flightPoint(progress), phase: time >= flightDuration ? 'landed' : 'flight', bounced: false };
        }
        const t = (time - flightDuration) / bounceDuration;
        return {
            x: lerp(landing.x, bounceEnd.x, t),
            y: landing.y + Math.sin(Math.PI * t) * metadata.bounce.heightFeet * FEET_TO_METERS,
            z: lerp(landing.z, bounceEnd.z, t),
            phase: t >= 1 ? 'complete' : 'bounce',
            bounced: true
        };
    }

    const netProgress = crossesNet ? (22 - metadata.from.y) / (metadata.to.y - metadata.from.y) : null;
    const netCrossingHeightMeters = netProgress === null ? null : flightPoint(netProgress).y;
    if (crossesNet && netCrossingHeightMeters < requiredCrossingFeet * FEET_TO_METERS - 1e-6) {
        throw new RangeError('Constructed trajectory does not clear the net.');
    }

    return Object.freeze({
        metadata,
        start,
        landing,
        bounceEnd,
        flightDuration,
        bounceDuration,
        totalDuration,
        netCrossingHeightMeters,
        sample
    });
}

export class PlaybackClock {
    constructor() {
        this.elapsed = 0;
        this.playbackRate = 1;
        this.playing = false;
        this.lastTimestamp = null;
    }

    play(timestamp = performance.now()) {
        if (this.playing) return;
        this.playing = true;
        this.lastTimestamp = timestamp;
    }

    pause() {
        this.playing = false;
        this.lastTimestamp = null;
    }

    restart() {
        this.elapsed = 0;
        this.lastTimestamp = null;
    }

    setRate(rate) {
        if (![1, 0.5, 0.25].includes(rate)) throw new RangeError('Unsupported playback rate.');
        this.playbackRate = rate;
    }

    update(timestamp) {
        if (!this.playing) return this.elapsed;
        if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
        const delta = Math.max(0, timestamp - this.lastTimestamp) / 1000;
        this.elapsed += delta * this.playbackRate;
        this.lastTimestamp = timestamp;
        return this.elapsed;
    }
}

export function compilePlayTimeline(play) {
    if (!play?.steps?.length) throw new TypeError('A Play requires at least one step.');
    const segments = [];
    let cursor = 0;
    for (let index = 1; index < play.steps.length; index += 1) {
        const previous = play.steps[index - 1];
        const step = play.steps[index];
        const trajectory = step.shot ? createTrajectory(step.shot) : null;
        const duration = trajectory?.totalDuration ?? Math.max(0.35, (step.durationMs || 850) / 1000);
        segments.push({ index, previous, step, trajectory, startTime: cursor, duration, endTime: cursor + duration });
        cursor += duration;
    }
    return { play, segments, duration: cursor };
}
