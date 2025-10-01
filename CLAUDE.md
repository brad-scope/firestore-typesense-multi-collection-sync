# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
This is a Firebase Extension that syncs data from multiple Firestore collections to Typesense for full-text search capabilities. It consists of three main Cloud Functions: `automatic_sync` (syncs changes), `manual_sync` (bulk imports existing data), and `scheduled_sync` (periodic syncs).

## Development Commands

### Running Tests
```bash
# Run all tests (flattened, unflattened, and subcollection)
npm test

# Run specific test suites
npm run test:flatttened
npm run test:unflattened
npm run test:subcollection

# Run a single test file
jest --testRegex="backfill.spec"
```

### Local Development
```bash
# Start Firebase emulator and Typesense server
npm run emulator
npm run typesenseServer

# Export emulator data
npm run export
```

### Code Quality
```bash
# Run ESLint
npm run lint
npm run lint:fix

# Run Prettier
npm run format
npm run format:check
```

## Architecture

### Extension Configuration
The extension is configured via `extension.yaml` which defines:
- Two Cloud Functions (`indexOnWrite` and `backfill`) using Firebase Functions v2 API
- Configuration parameters for Typesense connection and Firestore collection settings
- Node.js 22 runtime with 540s timeout

### Core Components

1. **functions/src/automaticSync.js**: Listens to Firestore document changes and syncs to Typesense in real-time
2. **functions/src/manualSync.js**: Batch imports existing Firestore data when triggered via `typesense_manual_sync` collection
3. **functions/src/scheduledSync.js**: Periodically syncs all configured collections
3. **functions/src/config.js**: Centralizes all environment variable configuration
4. **functions/src/utils.js**: Handles document transformation (flattening, type conversions for timestamps/geopoints)
5. **functions/src/createTypesenseClient.js**: Creates and configures the Typesense client

### Key Design Decisions

- **No automatic collection creation**: Users must create Typesense collections manually before installing
- **Configurable flattening**: Supports both nested objects (Typesense v0.24+) and flattened documents (v0.23.1 and below)
- **Batched backfill**: Uses 1000-document batches to prevent memory overflow on large collections
- **Subcollection support**: Can sync nested Firestore subcollections to Typesense
- **Multi-collection support**: Single installation can sync multiple collections via JSON configuration

## Testing Approach

Tests use Firebase emulators with a local Typesense server running in Docker. Test environment is configured via `.env` files in the `extensions/` directory for different flattening scenarios.

## Publishing Process

1. Update version in `extension.yaml`
2. Add entry to `CHANGELOG.md`
3. Create GitHub release
4. Run: `firebase ext:dev:upload inspect-scope/firestore-typesense-multi-sync`