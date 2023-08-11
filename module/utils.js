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
