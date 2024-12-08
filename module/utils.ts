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
 * Sleep for the set miliseconds
 * @param ms miliseconds
 * @returns
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses an standard CSV file
 * @param str text
 * @param delimiter csv delimiter
 * @returns
 */
export function parseCSV(str: string, delimiter = ',') {
	const rgx = new RegExp(`"(.*?)"${delimiter}?|^(.*?)${delimiter}|(.+)$`, 'g');
	const data = str.split(/(?:\r)?\n/);
	if (data.at(-1) === '') data.pop();
	const headers = [...data[0].matchAll(rgx)].map((r) => r[1] ?? r[2] ?? r[3]);
	const rows = data
		.slice(1)
		.map((r) => Object.fromEntries([...r.matchAll(rgx)].map((r, idx) => [headers[idx], r[1] ?? r[2] ?? r[3]])));

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
