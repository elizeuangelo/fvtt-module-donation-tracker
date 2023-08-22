import { Membership } from './membership.js';
import { updateButton } from './settings-button.js';

export const MODULE_ID = 'donation-tracker';
export const PATH = `modules/${MODULE_ID}`;

const settings = {
	server: {
		scope: 'world',
		config: false,
		type: String,
		default: '',
	},
	donationLinks: {
		scope: 'world',
		config: false,
		type: Array,
		default: [] as { link: string; img: string }[],
	},
	buttonLabel: {
		scope: 'world',
		config: false,
		type: String,
		default: 'My Account',
	},
	token: {
		scope: 'client',
		config: false,
		type: String,
		default: '',
		onChange: updateButton,
	},
	membershipLevels: {
		scope: 'world',
		config: false,
		type: Object,
		default: {
			base_currency: 'USD',
			period: '30 days',
			levels: [],
		} as Membership,
	},
};

export type Settings = typeof settings;

export function getSetting<T extends keyof Settings>(name: T) {
	return game.settings.get(MODULE_ID, name) as unknown as Settings[T]['default'];
}

export function setSetting<T extends keyof Settings>(name: T, value: Settings[T]['default']) {
	return game.settings.set(MODULE_ID, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting as unknown as any);
	}
});
