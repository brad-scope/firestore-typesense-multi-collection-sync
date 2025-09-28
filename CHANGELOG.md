## Version 3.0.0

### Major Enhancement Release - Multi-Collection Support

This is a fork and major enhancement of the original Typesense Firebase extension by Brad Mallow at Scope Inspections.

#### Breaking Changes
- Extension renamed to `firestore-typesense-multi-sync`
- Changed trigger mechanism for manual sync (now uses any document creation in `typesense_manual_sync`)
- Functions renamed: `indexOnWrite` → `automatic_sync`, `backfill` → `manual_sync`

#### New Features
- **Multi-Collection Support**: Sync multiple Firestore collections from a single extension installation
- **JSON Configuration**: Define all collections in one `COLLECTIONS_CONFIG` parameter
- **Selective Manual Sync**: Sync specific documents or collections on demand via paths array
- **Scheduled Sync**: Optional periodic sync at configurable intervals
- **ID Field Preservation**: Existing `id` fields are preserved as `_id`
- **Path Tracking**: Optional `_path` field to track source document paths
- **Sync Status Tracking**: Real-time metadata updates during manual sync operations
- **Wildcard Support**: Both `*` and `{paramName}` syntaxes supported for subcollections
- **Collection Group Queries**: Efficient subcollection syncing across document hierarchies

#### Improvements
- Single wildcard trigger with efficient path matching
- Sequential processing for reliability
- Detailed sync progress reporting
- Better error handling and logging

#### Configuration
- Replaced individual collection parameters with unified `COLLECTIONS_CONFIG` JSON
- Added `INCLUDE_FIRESTORE_PATH` parameter for optional path tracking
- Added `SCHEDULED_SYNC_INTERVAL` parameter for periodic syncs

## Version 2.1.0

- Allow region configuration to be mutable

## Version 2.0.1

- Support for syncing data from sub-collections
- Use action=upsert for backfill
- Migrate to Firebase Functions V2 API
- Upgrade to Node 22
- Improvements to logging for debugging purposes
- Support for non-default databases
- [2.0.1] Fix for "Database does not exist in region" error during installation

## Version 2.0.0

- Support for syncing data from sub-collections
- Use action=upsert for backfill
- Migrate to Firebase Functions V2 API
- Upgrade to Node 22
- Improvements to logging for debugging purposes
- Support for non-default databases

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
