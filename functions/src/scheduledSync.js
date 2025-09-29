const {onSchedule} = require("firebase-functions/v2/scheduler");
const {info, error} = require("firebase-functions/logger");
const config = require("./config.js");
const createTypesenseClient = require("./createTypesenseClient.js");

// Import the sync logic from manualSync
const admin = require("firebase-admin");
const utils = require("./utils.js");

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Sync documents from a specific Firestore collection to Typesense
 * (Reused from manualSync.js)
 */
async function syncCollection(collectionConfig, typesense) {
  info(
    "[SCHEDULED SYNC START] Syncing " +
      `${collectionConfig.firestoreFields.length > 0 ? collectionConfig.firestoreFields.join(",") : "all"} fields in Firestore documents ` +
      `from ${collectionConfig.firestorePath} ` +
      `into Typesense Collection ${collectionConfig.typesenseCollection}`,
  );

  // Log the raw configuration being used
  info(`[SCHEDULED CONFIG] Using configuration: ${JSON.stringify(collectionConfig)}`);

  const pathSegments = collectionConfig.firestorePath.split("/").filter(Boolean);
  const pathPlaceholders = utils.parseFirestorePath(collectionConfig.firestorePath);
  const isGroupQuery = pathSegments.length > 1 && utils.hasWildcard(collectionConfig.firestorePath);

  info(`[SCHEDULED QUERY TYPE] Path segments: ${JSON.stringify(pathSegments)}, Is group query: ${isGroupQuery}, Has wildcards: ${utils.hasWildcard(collectionConfig.firestorePath)}`);

  let querySnapshot;
  if (isGroupQuery) {
    const collectionGroup = pathSegments[pathSegments.length - 1];
    info(`[SCHEDULED COLLECTION GROUP] Using collection group query for: ${collectionGroup}`);
    querySnapshot = admin.firestore().collectionGroup(collectionGroup);
  } else {
    info(`[SCHEDULED COLLECTION] Using standard collection query for: ${collectionConfig.firestorePath}`);
    querySnapshot = admin.firestore().collection(collectionConfig.firestorePath);
  }

  let lastDoc = null;
  let totalImported = 0;
  let batchNumber = 0;
  let totalDocumentsFound = 0;
  let skippedDocuments = 0;
  let errors = [];

  info(`[SCHEDULED BATCH CONFIG] Using batch size: ${config.typesenseBackfillBatchSize}`);

  do {
    batchNumber++;

    // Add safety check for infinite loops
    if (batchNumber > 1000) {
      error(`[SCHEDULED SAFETY] Stopping after 1000 batches to prevent infinite loop. Processed ${totalImported} documents so far.`);
      break;
    }
    const queryForThisBatch = lastDoc ? querySnapshot.startAfter(lastDoc) : querySnapshot;
    const thisBatch = await queryForThisBatch.limit(config.typesenseBackfillBatchSize).get();

    info(`[SCHEDULED BATCH ${batchNumber}] Fetched ${thisBatch.size} documents from Firestore`);
    totalDocumentsFound += thisBatch.size;

    if (thisBatch.empty) {
      info(`[SCHEDULED BATCH ${batchNumber}] No more documents to process`);
      break;
    }
    const currentDocumentsBatch = (
      await Promise.all(
        thisBatch.docs.map(async (doc) => {
          const docPath = doc.ref.path;

          // For group queries, check if the document matches the pattern
          if (isGroupQuery) {
            const pathParams = utils.pathMatchesSelector(docPath, collectionConfig.firestorePath);
            if (pathParams === null) {
              info(`[SCHEDULED SKIP] Document ${docPath} doesn't match pattern ${collectionConfig.firestorePath}`);
              skippedDocuments++;
              return null;
            }
            info(`[SCHEDULED MATCH] Document ${docPath} matches pattern ${collectionConfig.firestorePath}`);
          }

          const pathParams = utils.pathMatchesSelector(docPath, collectionConfig.firestorePath) || {};
          const typesenseDocument = await utils.typesenseDocumentFromSnapshot(doc, pathParams, collectionConfig.firestoreFields);
          return typesenseDocument;
        }),
      )
    ).filter((doc) => doc !== null);

    info(`[SCHEDULED BATCH ${batchNumber}] Prepared ${currentDocumentsBatch.length} documents for Typesense (${skippedDocuments} skipped so far)`);

    lastDoc = thisBatch.docs.at(-1) ?? null;
    try {
      const importResult = await typesense.collections(encodeURIComponent(collectionConfig.typesenseCollection)).documents().import(currentDocumentsBatch, {action: "upsert", return_id: true});
      totalImported += currentDocumentsBatch.length;
      info(`[SCHEDULED BATCH ${batchNumber} SUCCESS] Imported ${currentDocumentsBatch.length} documents into Typesense collection ${collectionConfig.typesenseCollection} (total imported: ${totalImported}/${totalDocumentsFound})`);
    } catch (err) {
      error(`[SCHEDULED BATCH ${batchNumber} ERROR] Import error in collection ${collectionConfig.typesenseCollection}`, err);
      errors.push({
        batch: batchNumber,
        error: err.message,
        documentsInBatch: currentDocumentsBatch.length
      });

      // Don't stop on error - continue with next batch
      error(`[SCHEDULED BATCH ${batchNumber}] Continuing despite error...`);
    }

    // Check if we should continue
    if (thisBatch.size < config.typesenseBackfillBatchSize) {
      info(`[SCHEDULED BATCH ${batchNumber}] Batch size ${thisBatch.size} is less than max ${config.typesenseBackfillBatchSize}, stopping`);
      break;
    } else {
      info(`[SCHEDULED BATCH ${batchNumber}] Batch full (${thisBatch.size}), continuing to next batch`);
    }
    await new Promise((resolve) => process.nextTick(resolve));
  } while (lastDoc);

  info(`[SCHEDULED SYNC COMPLETE] Done syncing ${collectionConfig.firestorePath} to ${collectionConfig.typesenseCollection}`);
  info(`[SCHEDULED STATS] Total documents found: ${totalDocumentsFound}, Imported: ${totalImported}, Skipped: ${skippedDocuments}, Errors: ${errors.length}`);

  if (totalImported < totalDocumentsFound - skippedDocuments) {
    error(`[SCHEDULED WARNING] Not all documents were imported! Expected ${totalDocumentsFound - skippedDocuments}, got ${totalImported}`);
  }

  return {totalImported, totalDocumentsFound, skippedDocuments, errors};
}

/**
 * Scheduled function that syncs all configured collections to Typesense
 */
// Use a far-future schedule when disabled (effectively never runs)
const schedule = (config.scheduledSyncInterval && config.scheduledSyncInterval !== "never")
  ? config.scheduledSyncInterval
  : "0 0 1 1 *"; // January 1st at midnight (runs once a year)

module.exports = onSchedule(
  {
    schedule: schedule,
    timeZone: "UTC",
    retryConfig: {
      retryCount: 3,
      minBackoffDuration: "10s",
      maxBackoffDuration: "300s",
    },
  },
  async (event) => {
    // Check if scheduled sync is actually enabled
    if (!config.scheduledSyncInterval || config.scheduledSyncInterval === "never") {
      info("Scheduled sync is disabled");
      return;
    }

    info(`[SCHEDULED SYNC TRIGGERED] Starting scheduled sync at ${new Date().toISOString()}`);
    info(`[SCHEDULED CONFIG CHECK] Collections configured: ${config.collectionsConfig ? config.collectionsConfig.length : 0}`);

    const typesense = createTypesenseClient();

    if (config.collectionsConfig && config.collectionsConfig.length > 0) {
      info(`[SCHEDULED COLLECTIONS] Processing ${config.collectionsConfig.length} configured collections`);
      info(`[SCHEDULED COLLECTIONS CONFIG] ${JSON.stringify(config.collectionsConfig)}`);

      // Process each collection sequentially
      for (const collectionConfig of config.collectionsConfig) {
        try {
          await syncCollection(collectionConfig, typesense);
        } catch (err) {
          error(`Scheduled sync: Failed to sync collection ${collectionConfig.firestorePath}`, err);
          // Continue to next collection even if one fails
        }
      }

      info("Scheduled sync: Completed all collections");
    } else if (config.firestoreCollectionPath) {
      // Fallback to legacy single collection config for backward compatibility
      info("Scheduled sync: Using legacy single collection configuration");

      const legacyConfig = {
        firestorePath: config.firestoreCollectionPath,
        typesenseCollection: config.typesenseCollectionName,
        firestoreFields: config.firestoreCollectionFields,
      };

      try {
        await syncCollection(legacyConfig, typesense);
      } catch (err) {
        error("Scheduled sync: Failed to sync legacy collection", err);
      }
    } else {
      error("Scheduled sync: No collection configuration found");
    }

    info(`Scheduled sync completed at ${new Date().toISOString()}`);
  },
);