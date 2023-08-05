import { PATH, setSetting } from '../settings.js';
import * as API from '../api.js';
export class LoginApp extends Application {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'dt-login',
            title: `Register your Email`,
            classes: ['sheet'],
            template: `${PATH}/templates/login.html`,
            tabs: [{ navSelector: '.tabs[data-group=primary]', contentSelector: 'form', initial: 'main' }],
            width: 400,
            height: 'auto',
        });
    }
    email = null;
    async sendEmail() {
        const email = this.element.find('input[name=email]').val();
        this.email = email;
        const btn = this.element.find('#email');
        btn.prop('disabled', true);
        try {
            const res = await API.requestCode(email);
            if (!res.ok)
                throw new Error(`Server returned err ${res.status}: ${res.statusText}`);
            this.activateTab('confirmation');
        }
        catch {
            ui.notifications.error('Some error ocurred when sending the email');
        }
        finally {
            btn.prop('disabled', false);
        }
    }
    async confirmCode() {
        const code = this.element.find('input[name=code]').val();
        const btn = this.element.find('#code');
        btn.prop('disabled', true);
        try {
            const res = await API.verifyCode(this.email, code);
            if (!res.ok) {
                if (res.status !== 400) {
                    throw new Error(`Server returned err ${res.status}: ${res.statusText}`);
                }
                ui.notifications.error(`The code is invalid or has expired`);
            }
            else {
                const { token } = await res.json();
                setSetting('token', token);
                this.activateTab('finish');
            }
        }
        catch {
            ui.notifications.error('Some error ocurred when confirming the code');
        }
        finally {
            btn.prop('disabled', false);
        }
    }
    activateListeners(html) {
        super.activateListeners(html);
        const actions = {
            'send-email': this.sendEmail,
            'confirm-code': () => { },
        };
        html.find('[data-action]').each((idx, el) => el.addEventListener('click', () => actions[el.dataset.action].call(this, el)));
    }
    async close() {
        this.email = null;
        super.close({ force: true });
    }
}
