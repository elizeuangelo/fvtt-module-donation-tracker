export function parseTime(time) {
    const table = {
        d: 86_400_000,
        w: 604_800_000,
        m: 2_292_000_000,
    };
    const rgx = /([0-9]+) ?(d|w|m)/;
    const match = rgx.exec(time);
    if (match === null) {
        console.error(`Cant parse time from string: ${time}`);
        return null;
    }
    return +match[1] * table[match[2]];
}
export async function readFile() {
    const input = $('<input type="file">');
    return new Promise((resolve) => {
        input.on('change', (ev) => {
            const file = ev.target.files[0];
            if (!file) {
                alert('No file selected.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const fileContent = ev.target.result;
                resolve({ file, data: fileContent });
            };
            reader.onabort = reader.onerror = () => resolve(null);
            reader.readAsText(file);
        });
        input.trigger('click');
    });
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function parseCSV(str, delimiter = ',') {
    const rgx = new RegExp(`"(.*?)"${delimiter}?|^(.*?)${delimiter}|(.+)$`, 'g');
    const data = str.split(/(?:\r)?\n/);
    if (data.at(-1) === '')
        data.pop();
    const headers = [...data[0].matchAll(rgx)].map((r) => r[1] ?? r[2] ?? r[3]);
    const rows = data
        .slice(1)
        .map((r) => Object.fromEntries([...r.matchAll(rgx)].map((r, idx) => [headers[idx], r[1] ?? r[2] ?? r[3]])));
    return { headers, rows };
}
