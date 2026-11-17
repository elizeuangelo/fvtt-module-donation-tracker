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

## v1.1.0

-   Developer mode implemented
-   Project is now full typescript

## v1.0.0

-   First release
