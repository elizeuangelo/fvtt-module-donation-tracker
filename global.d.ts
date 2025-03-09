import type { MembershipAPI } from './module/membership.ts';

declare global {
	interface LenientGlobalVariableTypes {
		canvas: never;
		game: never;
		socket: never;
		ui: never;
	}
	interface Window {
		ForgeVTT: any;
	}
	interface Game {
		membership: MembershipAPI;
	}
	interface Tabs {
		settings: any;
	}
	var objectsEqual: (a, b) => boolean;

	const game: Game;
	const ui: FoundryUI<ActorDirectory, ItemDirectory, any, any, any>;
	const canvas: Canvas;
	const CONFIG: Config;
}

export {};
