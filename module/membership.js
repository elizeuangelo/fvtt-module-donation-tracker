import { getSetting } from './settings.js';
import { parseTime } from './utils.js';
import * as API from './api.js';
function convertRates(data, to) {
    const baseRate = data.rates[to];
    const rates = { ...data.rates };
    rates[data.base] = 1;
    Object.entries(rates).forEach(([k]) => (rates[k] /= baseRate));
    data.base = to;
    data.rates = rates;
}
export async function myMembershipLevel() {
    if (!API.isValid())
        return null;
    const promises = [API.myDonations(), API.rates()];
    const [myDonations, rates] = await Promise.all(promises);
    const membershipLevels = getSetting('membershipLevels');
    return calcMembershipLevel({ ...myDonations, email: myDonations.kofi?.email ?? myDonations.manual.email }, rates, membershipLevels);
}
export function getMembersData(donations) {
    const members = {};
    donations.kofi.forEach((e) => (members[e.email] = { email: e.email, kofi: e }));
    donations.manual.forEach((e) => {
        if (members[e.email])
            members[e.email].manual = e;
        members[e.email] = { email: e.email, manual: e };
    });
    return members;
}
export function parseMembers() { }
export function calcMembershipLevel(data, rates, membershipLevels = getSetting('membershipLevels')) {
    if (rates.base !== membershipLevels.base_currency)
        convertRates(rates, membershipLevels.base_currency);
    const period = parseTime(membershipLevels.period);
    if (!period)
        throw new Error('Bad membership period');
    const since = Date.now() - period;
    let donated = 0, donatedAll = 0;
    data.kofi?.donations.forEach((entry) => {
        const value = +entry.amount / rates.rates[entry.currency];
        donatedAll += value;
        const date = new Date(entry.timestamp).getTime();
        if (date < since)
            return;
        donated += value;
    });
    data.manual?.donations.forEach((entry) => {
        const value = +entry.amount / rates.rates[entry.currency];
        donatedAll += value;
        if (entry.timestamp < since)
            return;
        donated += value;
    });
    const membership = membershipLevels.levels.findLast((entry) => entry.accrued <= donated) ?? null;
    return { membership, donated, donatedAll };
}
export async function hasPermission(levelId) {
    const myLevel = await myMembershipLevel();
    if (!myLevel || !myLevel.membership)
        return false;
    const membershipLevels = getSetting('membershipLevels').levels;
    const myIdx = membershipLevels.findIndex((entry) => entry.id === myLevel.membership.id);
    const targetIdx = membershipLevels.findIndex((entry) => entry.id === levelId);
    return myIdx >= targetIdx;
}
