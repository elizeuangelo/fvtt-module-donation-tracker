import { LoginApp } from './apps/login.js';
import { Dashboard } from './apps/dashboard.js';
import { getSetting } from './settings.js';
import * as API from './api.js';
export function updateButton() {
    const btn = document.getElementById('dt-btn');
    if (!btn)
        return;
    if (API.isAdmin())
        btn.innerHTML = `<i class='fas fa-users-viewfinder'></i> Server Dashboard`;
    else
        btn.innerHTML = `<i class='fas fa-user-pen'></i> ${getSetting('buttonLabel')}`;
}
export function createButton(html) {
    const btn = $(`<button id="dt-btn"></button>`);
    html.find('#settings-game').append(btn);
    btn.on('click', () => {
        if (API.isAdmin())
            new Dashboard().render(true);
        else
            new LoginApp().render(true);
    });
    updateButton();
}
function renderSettings(setting, html) {
    createButton(html);
}
Hooks.on('renderSettings', renderSettings);
