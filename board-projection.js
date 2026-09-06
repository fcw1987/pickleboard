(function exposeBoardProjection(global) {
    'use strict';

    const SHEAR = 0.12;
    const DEPTH_SCALE = 0.9;
    const COURT_MIDLINE = 22;
    const MATRIX = Object.freeze({
        a: 1,
        b: 0,
        c: -SHEAR,
        d: DEPTH_SCALE,
        e: SHEAR * COURT_MIDLINE,
        f: 0
    });
    const COURT_VIEWBOX = Object.freeze({ x: -13, y: -11, width: 47, height: 60 });

    function courtToView(xOrPoint, optionalY) {
        const point = typeof xOrPoint === 'object'
            ? xOrPoint
            : { x: xOrPoint, y: optionalY };
        return {
            x: MATRIX.a * point.x + MATRIX.c * point.y + MATRIX.e,
            y: MATRIX.d * point.y
        };
    }

    function viewToCourt(xOrPoint, optionalY) {
        const point = typeof xOrPoint === 'object'
            ? xOrPoint
            : { x: xOrPoint, y: optionalY };
        const y = point.y / MATRIX.d;
        return {
            x: point.x - MATRIX.c * y - MATRIX.e,
            y
        };
    }

    function svgMatrix() {
        const values = [MATRIX.a, MATRIX.b, MATRIX.c, MATRIX.d, MATRIX.e, MATRIX.f]
            .map(value => Number(value.toFixed(10)));
        return `matrix(${values.join(' ')})`;
    }

    global.PickleboardProjection = Object.freeze({
        COURT_VIEWBOX,
        HEIGHT_SCALE: Math.sqrt(1 - DEPTH_SCALE * DEPTH_SCALE),
        projectHeight: feet => feet * Math.sqrt(1 - DEPTH_SCALE * DEPTH_SCALE),
        MATRIX,
        courtToView,
        viewToCourt,
        svgMatrix
    });
})(window);
