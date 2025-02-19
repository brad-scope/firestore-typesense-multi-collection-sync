## Version 2.0.0

- Support for syncing data from sub-collections
- Use action=upsert for backfill
- Migrate to Firebase Functions V2 API
- Upgrade to Node 22

## Version 1.5.0

- Use batching to back-fill, to prevent memory overflow when back-filling large collections
- Fix handling incorrect casting of nested objects into geopoints
- Allow specifying nested field names in list of fields to sync

## Version 1.4.1

- Only log error documents in backfill log

## Version 1.4.0

- Shorten function names to fix issue with local emulator

## Version 1.3.0

- Use `action=upsert` for back-filling data

## Version 1.2.0

- Upgrade to Node 18

## Version 1.1.0

- Add random jitter to retries to handle potential thundering herd issues for high volume writes.
- Upgrade to Node 16

## Version 1.0.3

- Fixed instructions in changelog 

## Version 1.0.2

- Publish to extension hub

## Version 1.0.1

- Re-order parameters to improve installation UX

## Version 1.0.0

- Adds a new parameter that controls whether a nested Firestore document is flattened by the extension, or sent as is to Typesense.
  - If you are running Typesense Server v0.23.1 or below, set "Flatten Nested Documents" to "Yes" (since indexing nested fields is not supported in these versions).
  - If you are running Typesense Server v0.24 or above, set "Flatten Nested Documents" to "No" (since indexing nested fields is natively supported in Typesense in these versions).
- Read the latest snapshot of the document on each write, to prevent sync consistency issues given Firestore's out-of-order change triggers. See #32.
- Update dependencies
- Handle special characters in document ID


## Version 1.0.0-rc.4

- Handle special characters in document ID

## Version 1.0.0-rc.3

- Update dependencies

## Version 1.0.0-rc.2

- Remove stale parameter.

## Version 1.0.0-rc.1

- Adds a new parameter that controls whether a nested Firestore document is flattened by the extension, or sent as is to Typesense.
  - If you are running Typesense Server v0.23.1 or below, set "Flatten Nested Documents" to "Yes" (since indexing nested fields is not supported in these versions).
  - If you are running Typesense Server v0.24 or above, set "Flatten Nested Documents" to "No" (since indexing nested fields is natively supported in Typesense in these versions).
- Read the latest snapshot of the document on each write, to prevent sync consistency issues given Firestore's out-of-order change triggers. See #32.

## Version 0.4.2

- Fix documentation for triggering backfill

## Version 0.4.1

- Use `for...of` instead of `forEach` in backfill function. #37

## Version 0.4.0

- Sync ref.path to Typesense
- Ability to backfill specific collections to Typesense, when multiple instances of the extension are installed.

## Version 0.3.0

- Map Firestore Timestamps to int64 values in Typesense
- Map Firestore GeoPoint values to Typesense geopoint format
- Flatten nested field values to top-level keys in Typesense

## Version 0.2.8

- Add default values to params, add links to external services needed for plugin

## Version 0.2.7

- Support for Typesense collection names with special characters like `/`

## Version 0.2.6

- Update dependencies, to handle import errors

## Version 0.2.5

- Increase memory for backfill function

## Version 0.2.4

- Increase connection timeout

## Version 0.2.3

- Fixes post installation instructions

## Version 0.2.2

- Fixes "Backfill function attempts to rerun admin.initializeApp on rerun"

## Version 0.2.1

- Add additional regions

## Version 0.2.0

- Initial public release
