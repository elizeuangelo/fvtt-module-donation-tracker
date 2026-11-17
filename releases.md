# Patch Notes

## Unreleased

-   Works with Donation Tracker API 2 (the Rust server); older servers keep working
-   Removed the dashboard's Server tab: updates, restarts and configuration are done on the server itself
-   Fixed modifying, removing and refunding donations from the dashboard
-   Fixed the Ko-fi CSV import: unticked rows are no longer imported, duplicates are detected, times are read as UTC and messages with quotes or line breaks are parsed correctly
-   The dashboard's Refresh button always loads fresh data
-   Editing a donation or a special membership no longer shifts its time by the local time zone
-   Special memberships end at their expiry date instead of one period later
-   `membershipReady` always fires, also when the server cannot be reached (nobody has a membership until it is back)
-   A donation in a currency without an exchange rate no longer breaks the member's total
-   Admin tokens with accented names are read correctly
-   Dashboard totals are always in the configured base currency, also when there are no members, and follow a currency change right away
-   Dashboard totals deduct refunds, like the members' totals, and their counts cover the same donations as their amounts
-   Donations in a currency without an exchange rate are marked in the dashboard and listed under the totals; a warning shows when exchange rates are unavailable
-   Without exchange rates, donations in the base currency still count towards memberships
-   Refunds are matched to the donation with the same donor and currency; partial refunds leave the rest refundable
-   Editing or refunding a donation in a currency outside USD, EUR and GBP keeps its currency
-   The dashboard's time period filter no longer shifts by the local time zone
-   Expired special memberships are no longer highlighted in the dashboard

## v1.1.0

-   Developer mode implemented
-   Project is now full typescript

## v1.0.0

-   First release
