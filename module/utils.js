export function parseTime(time) {
    const table = {
        m: 60000,
        h: 3_600_000,
        d: 86_400_000,
        w: 604_800_000,
    };
    const rgx = /([0-9]+) ?(d|w|m)/;
    const match = rgx.exec(time);
    if (match === null) {
        console.error(`Cant parse time from string: ${time}`);
        return null;
    }
    return +match[1] * table[match[2]];
}
