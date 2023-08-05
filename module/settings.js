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
        onchange: updateButton,
    },
};
export function getSetting(name) {
    return game.settings.get(MODULE_ID, name);
}
export function setSetting(name, value) {
    return game.settings.set(MODULE_ID, name, value);
}
Hooks.once('setup', () => {
    for (const [key, setting] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, setting);
    }
});
