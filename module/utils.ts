export function parseTime(time: string) {
	const table = {
		d: 86_400_000,
		w: 604_800_000,
		m: 2_592_000_000,
		y: 31_536_000_000,
	};

	const rgx = /([0-9]+) ?(d|w|m|y)/;
	const match = rgx.exec(time);
	if (match === null) {
		console.error(`Cant parse time from string: ${time}`);
		return null;
	}

	return +match[1] * table[match[2] as keyof typeof table];
}

interface FileResult {
	file: File;
	data: string | ArrayBuffer | null;
}

export async function readFile(): Promise<FileResult | null> {
	const input = $('<input type="file">');
	return new Promise((resolve) => {
		input.on('change', (ev) => {
			const file = (ev.target as HTMLInputElement).files![0];

			if (!file) {
				alert('No file selected.');
				return;
			}

			const reader = new FileReader();

			// Define the function to execute when the file is successfully loaded
			reader.onload = (ev) => {
				const fileContent = ev.target!.result;
				// Do something with the file content, e.g., display it on the page
				resolve({ file, data: fileContent });
			};

			reader.onabort = reader.onerror = () => resolve(null);

			// Read the file as text
			reader.readAsText(file);
		});
		input.trigger('click');
	});
}

/**
 * Reads a timestamp that is known to be in UTC but carries no time zone, such as the
 * `DateTime (UTC)` column of a Ko-fi export (`09/13/2020 16:55`).
 * @param text date and time
 * @returns milliseconds since the epoch, or NaN when the text is not a date
 */
export function parseUtcDate(text: string): number {
	text = text.trim();
	const kofi = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
	if (kofi) {
		const [month, day, year, hour, minute, second] = kofi.slice(1).map((part) => Number(part ?? 0));
		return Date.UTC(year, month - 1, day, hour, minute, second);
	}
	const parsed = new Date(text).getTime();
	const alreadyUtc =
		/^\d{4}-\d{2}-\d{2}$/.test(text) || /\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(z|utc|gmt|[+-]\d{2}:?\d{2})$/i.test(text);
	if (Number.isNaN(parsed) || alreadyUtc) return parsed;
	// The text was read as local time: move it back by the local offset.
	return parsed - new Date(parsed).getTimezoneOffset() * 60_000;
}

/**
 * Formats a timestamp for an `<input type="datetime-local">`, which shows and reads local time.
 * @param timestamp milliseconds since the epoch
 */
export function toDatetimeLocal(timestamp: number): string {
	const date = new Date(timestamp);
	return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Parses a CSV file: quoted fields may contain delimiters, line breaks and doubled quotes.
 * @param str text
 * @param delimiter csv delimiter
 * @returns the header names and one record per data line, keyed by header
 */
export function parseCSV(str: string, delimiter = ',') {
	const text = str.replace(/^\uFEFF/, '');
	const table: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char !== '"') field += char;
			else if (text[i + 1] === '"') {
				field += '"';
				i++;
			} else quoted = false;
		} else if (char === '"' && field === '') {
			quoted = true;
		} else if (char === delimiter) {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			table.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		table.push(row);
	}

	const [headers = [], ...lines] = table;
	const rows = lines
		.filter((line) => line.some((value) => value !== ''))
		.map(
			(line) => Object.fromEntries(headers.map((header, idx) => [header, line[idx] ?? ''])) as Record<string, string>,
		);

	return { headers, rows };
}

/**
 * Slugifies a given text string
 * @param str Text to slugify
 * @returns Sluggified text
 */
export function slugifyCamelCase(text: string) {
	return (
		text
			.toLowerCase()
			.match(/[a-z0-9]+/g) // Match words and numbers, ignoring special characters
			?.map(
				(word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)) // Capitalize the first letter of each word except the first
			)
			.join('') ?? ''
	); // Join words without any separators
}
