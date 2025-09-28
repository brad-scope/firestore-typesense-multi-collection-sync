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
    "Scheduled sync: Syncing " +
      `${collectionConfig.firestoreFields.length > 0 ? collectionConfig.firestoreFields.join(",") : "all"} fields in Firestore documents ` +
      `from ${collectionConfig.firestorePath} ` +
      `into Typesense Collection ${collectionConfig.typesenseCollection}`,
  );

  const pathSegments = collectionConfig.firestorePath.split("/").filter(Boolean);
  const pathPlaceholders = utils.parseFirestorePath(collectionConfig.firestorePath);
  const isGroupQuery = pathSegments.length > 1 && utils.hasWildcard(collectionConfig.firestorePath);

  let querySnapshot;
  if (isGroupQuery) {
    const collectionGroup = pathSegments[pathSegments.length - 1];
    querySnapshot = admin.firestore().collectionGroup(collectionGroup);
  } else {
    querySnapshot = admin.firestore().collection(collectionConfig.firestorePath);
  }

  let lastDoc = null;
  let totalImported = 0;

  do {
    const queryForThisBatch = lastDoc ? querySnapshot.startAfter(lastDoc) : querySnapshot;
    const thisBatch = await queryForThisBatch.limit(config.typesenseBackfillBatchSize).get();
    if (thisBatch.empty) {
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
              return null;
            }
          }

          const pathParams = utils.pathMatchesSelector(docPath, collectionConfig.firestorePath) || {};
          const typesenseDocument = await utils.typesenseDocumentFromSnapshot(doc, pathParams, collectionConfig.firestoreFields);
          return typesenseDocument;
        }),
      )
    ).filter((doc) => doc !== null);

    lastDoc = thisBatch.docs.at(-1) ?? null;
    try {
      await typesense.collections(encodeURIComponent(collectionConfig.typesenseCollection)).documents().import(currentDocumentsBatch, {action: "upsert", return_id: true});
      totalImported += currentDocumentsBatch.length;
      info(`Scheduled sync: Imported ${currentDocumentsBatch.length} documents into Typesense collection ${collectionConfig.typesenseCollection} (total: ${totalImported})`);
    } catch (err) {
      error(`Scheduled sync: Import error in collection ${collectionConfig.typesenseCollection}`, err);
    }

    if (currentDocumentsBatch.length < config.typesenseBackfillBatchSize) {
      break;
    }
    await new Promise((resolve) => process.nextTick(resolve));
  } while (lastDoc);

  info(`Scheduled sync: Done syncing ${totalImported} documents from ${collectionConfig.firestorePath} to Typesense collection ${collectionConfig.typesenseCollection}`);
}

/**
 * Scheduled function that syncs all configured collections to Typesense
 */
module.exports = onSchedule(
  {
    schedule: config.scheduledSyncInterval || "never",
    timeZone: "UTC",
    retryConfig: {
      retryCount: 3,
      minBackoffDuration: "10s",
      maxBackoffDuration: "300s",
    },
  },
  async (event) => {
    // Check if scheduled sync is enabled
    if (!config.scheduledSyncInterval || config.scheduledSyncInterval === "never") {
      info("Scheduled sync is disabled");
      return;
    }

    info(`Starting scheduled sync at ${new Date().toISOString()}`);

    const typesense = createTypesenseClient();

    if (config.collectionsConfig && config.collectionsConfig.length > 0) {
      info(`Scheduled sync: Processing ${config.collectionsConfig.length} configured collections`);

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