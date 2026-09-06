// One session clock and loop position; views own rendering, never separate time.
import { PlaybackClock } from './three-d-core.js';

export class CoachingSession {
    constructor() {
        this.clock = new PlaybackClock();
        this.loop = false;
        this.holdSeconds = 1;
        this.owner = 'guided';
        this.reset(0);
    }
    reset(duration) {
        this.clock.pause();
        this.clock.restart();
        this.duration = Math.max(0, duration);
        this.holding = false;
        this.holdElapsed = 0;
        this.iteration = 0;
        this.complete = false;
    }
    seek(seconds) {
        this.clock.pause();
        this.clock.elapsed = Math.max(0, Math.min(this.duration, seconds));
        this.holding = false;
        this.holdElapsed = 0;
        this.complete = false;
    }
    play(timestamp = performance.now()) {
        if (this.complete || (!this.holding && this.clock.elapsed >= this.duration)) this.seek(0);
        this.complete = false;
        this.clock.play(timestamp);
    }
    pause(timestamp = performance.now(), timeScale = 1) {
        // A held scene has no RAF; capture its consumed hold before cancelling wakeup.
        if (this.holding && this.clock.playing) this.tick(timestamp, timeScale);
        this.clock.pause();
    }
    setLoop(enabled, timestamp = performance.now(), timeScale = 1) {
        if (this.holding && this.clock.playing) this.tick(timestamp, timeScale);
        this.loop = Boolean(enabled);
        if (!this.loop && this.holding) {
            this.clock.elapsed = this.duration;
            this.holding = false;
            this.holdElapsed = 0;
            this.complete = true;
            this.clock.pause();
        }
    }
    tick(timestamp, timeScale = 1) {
        if (!this.clock.playing) return this.clock.elapsed;
        const before = this.clock.elapsed;
        const delta = (this.clock.update(timestamp) - before) / Math.max(0.001, timeScale);
        let position = before + (this.holding ? this.holdElapsed : 0) + delta;
        if (this.duration <= 0) {
            this.clock.elapsed = 0;
            this.clock.pause();
            return this.clock.elapsed;
        }
        if (this.loop) {
            const cycle = this.duration + this.holdSeconds;
            const crossed = Math.floor(position / cycle);
            if (crossed) { this.iteration += crossed; position %= cycle; }
            if (Math.abs(position) < 1e-9) position = 0;
            else if (cycle - position < 1e-9) { this.iteration += 1; position = 0; }
            this.holding = position >= this.duration;
            this.holdElapsed = Math.max(0, position - this.duration);
            this.clock.elapsed = Math.min(position, this.duration);
        } else {
            this.clock.elapsed = Math.min(position, this.duration);
            this.holding = false;
            this.holdElapsed = 0;
            if (position >= this.duration) { this.complete = true; this.clock.pause(); }
        }
        return this.clock.elapsed;
    }
    remainingHoldMs(timeScale = 1) {
        return Math.max(0, this.holdSeconds - this.holdElapsed) * 1000 * timeScale / this.clock.playbackRate;
    }
}
