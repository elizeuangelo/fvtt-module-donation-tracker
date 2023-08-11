export function parseTime(time: string) {
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
