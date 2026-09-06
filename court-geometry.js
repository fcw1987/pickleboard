// Regulation court geometry in the board's native feet coordinate system.

const freezePoint = point => Object.freeze({ x: point.x, y: point.y });
const line = (name, from, to) => Object.freeze({
    name,
    from: freezePoint(from),
    to: freezePoint(to),
    lineWidthFeet: 1 / 6
});

export const COURT_DIMENSIONS = Object.freeze({
    widthFeet: 20,
    lengthFeet: 44,
    kitchenDepthFeet: 7,
    nearKitchenLineY: 15,
    netY: 22,
    farKitchenLineY: 29,
    netCenterHeightFeet: 34 / 12,
    netSidelineHeightFeet: 36 / 12,
    lineWidthFeet: 1 / 6,
    ballDiameterMeters: 0.074
});

export const COURT_LINES = Object.freeze([
    line('near-baseline', { x: 0, y: 0 }, { x: 20, y: 0 }),
    line('far-baseline', { x: 0, y: 44 }, { x: 20, y: 44 }),
    line('left-sideline', { x: 0, y: 0 }, { x: 0, y: 44 }),
    line('right-sideline', { x: 20, y: 0 }, { x: 20, y: 44 }),
    line('near-kitchen-line', { x: 0, y: 15 }, { x: 20, y: 15 }),
    line('far-kitchen-line', { x: 0, y: 29 }, { x: 20, y: 29 }),
    line('near-centerline', { x: 10, y: 0 }, { x: 10, y: 15 }),
    line('far-centerline', { x: 10, y: 29 }, { x: 10, y: 44 })
]);

export function isFiniteBoardPoint(point) {
    return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function isOnCourt(point) {
    return isFiniteBoardPoint(point) && point.x >= 0 && point.x <= COURT_DIMENSIONS.widthFeet &&
        point.y >= 0 && point.y <= COURT_DIMENSIONS.lengthFeet;
}

// Non-volley-zone lines are part of the non-volley zone.
export function isInNonVolleyZone(point) {
    return isFiniteBoardPoint(point) && point.x >= 0 && point.x <= COURT_DIMENSIONS.widthFeet &&
        point.y >= COURT_DIMENSIONS.nearKitchenLineY && point.y <= COURT_DIMENSIONS.farKitchenLineY;
}

export function serviceBoxForServer(serverPoint) {
    if (!isFiniteBoardPoint(serverPoint)) throw new TypeError('A finite server point is required.');
    const servesTowardFarEnd = serverPoint.y < COURT_DIMENSIONS.netY;
    const targetIsLeft = serverPoint.x > COURT_DIMENSIONS.widthFeet / 2;
    return Object.freeze({
        minX: targetIsLeft ? 0 : COURT_DIMENSIONS.widthFeet / 2,
        maxX: targetIsLeft ? COURT_DIMENSIONS.widthFeet / 2 : COURT_DIMENSIONS.widthFeet,
        minY: servesTowardFarEnd ? COURT_DIMENSIONS.farKitchenLineY : 0,
        maxY: servesTowardFarEnd ? COURT_DIMENSIONS.lengthFeet : COURT_DIMENSIONS.nearKitchenLineY
    });
}

export function isInServiceBox(point, box) {
    return isFiniteBoardPoint(point) && point.x >= box.minX && point.x <= box.maxX &&
        point.y >= box.minY && point.y <= box.maxY;
}
