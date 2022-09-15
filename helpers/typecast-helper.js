export function typeCast(value) {
    if(value === 'true')
        return true;

    if(value === 'false')
        return false;
    
    if (value === '')
        return '';

    let asNumber = Number(value);
    if (!Number.isNaN(asNumber))
        return asNumber;

    return value;
}

export function explodeTransformMatrix (matrix) {
    let findings = matrix.match(/-?\d*\.?\d+/g);
    return findings.map(f => typeCast(f));
}

export function camelCaseString (source) {
    return source.toLowerCase().replace(/\s+/g, '-').replace(/-([a-z])/g, (x, up) => up.toUpperCase());
}
