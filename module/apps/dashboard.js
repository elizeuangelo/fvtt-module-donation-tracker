import { PATH } from '../settings.js';
export class Dashboard extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'dt-dashboard',
            title: `Donation Tracker - Dashboard`,
            classes: ['sheet'],
            template: `${PATH}/templates/dashboard.html`,
            tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form', initial: 'table' }],
            width: 700,
            height: 'auto',
        });
    }
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();
        buttons.unshift({
            label: 'Save',
            class: 'save',
            icon: 'fas fa-save',
            onclick: () => { },
        });
        return buttons;
    }
    activateListeners(html) {
        super.activateListeners(html);
        const actions = {
            add: () => { },
        };
        html.find('[data-action]').each((idx, el) => el.addEventListener('click', () => actions[el.dataset.action].call(this, el)));
    }
    async getData(_options) {
        return {};
    }
    async close() {
        super.close({ force: true });
    }
}
