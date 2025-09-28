/* eslint-disable indent */
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {error, info, debug} = require("firebase-functions/logger");

const admin = require("firebase-admin");
const config = require("./config.js");
const createTypesenseClient = require("./createTypesenseClient.js");
const utils = require("./utils.js");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

/**
 * Find the collection configuration that matches a given path
 * @param {string} path - The Firestore path to check
 * @returns {Object|null} - The matching collection configuration or null
 */
function findMatchingCollectionConfig(path) {
  const segments = path.split("/").filter(Boolean);
  const isDocumentPath = segments.length % 2 === 0;

  for (const collectionConfig of config.collectionsConfig) {
    const pattern = collectionConfig.firestorePath;

    if (isDocumentPath) {
      // For document paths, check if the collection part matches
      const collectionPath = segments.slice(0, -1).join("/");

      // Check exact match first
      if (pattern === collectionPath) {
        return collectionConfig;
      }

      // Check pattern match with wildcards
      const regexPattern = pattern
        .split("/")
        .map((segment) => {
          if (segment === "*") {
            return "[^/]+";
          }
          return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/");

      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(collectionPath)) {
        return collectionConfig;
      }
    } else {
      // For collection paths, check if it matches the pattern
      if (pattern === path) {
        return collectionConfig;
      }

      // Check pattern match with wildcards
      const regexPattern = pattern
        .split("/")
        .map((segment) => {
          if (segment === "*") {
            return "[^/]+";
          }
          return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/");

      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(path)) {
        return collectionConfig;
      }
    }
  }

  return null;
}

/**
 * Sync a specific document to Typesense
 * @param {string} documentPath - Path to the specific document
 * @param {Object} collectionConfig - The collection configuration to use
 * @param {Object} typesense - Typesense client instance
 */
async function syncDocument(documentPath, collectionConfig, typesense) {
  try {
    info(`Syncing individual document: ${documentPath} to Typesense collection: ${collectionConfig.typesenseCollection}`);

    // Get the document
    const docRef = admin.firestore().doc(documentPath);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      info(`Document ${documentPath} does not exist, skipping`);
      return;
    }

    const pathSegments = documentPath.split("/");
    const docId = pathSegments[pathSegments.length - 1];
    const matchedParams = {docId: docId};

    // Extract wildcard parameters if pattern contains wildcards
    const pattern = collectionConfig.firestorePath;
    const patternSegments = pattern.split("/");
    const collectionPathSegments = pathSegments.slice(0, -1);

    patternSegments.forEach((segment, index) => {
      if (segment === "*" && collectionPathSegments[index]) {
        matchedParams[`param${Object.keys(matchedParams).length - 1}`] = collectionPathSegments[index];
      }
    });

    // Convert to Typesense document, respecting configured fields
    const typesenseDocument = await utils.typesenseDocumentFromSnapshot(
      docSnapshot,
      matchedParams,
      collectionConfig.firestoreFields
    );

    // Upsert to Typesense
    await typesense
      .collections(encodeURIComponent(collectionConfig.typesenseCollection))
      .documents()
      .upsert(typesenseDocument);

    info(`Successfully synced document ${documentPath} to Typesense collection ${collectionConfig.typesenseCollection}`);
  } catch (err) {
    error(`Failed to sync document ${documentPath}`, err);
    throw err;
  }
}

/**
 * Sync documents from a specific Firestore collection to Typesense
 * @param {Object} collectionConfig - Configuration for the collection to sync
 * @param {string} collectionConfig.firestorePath - The Firestore collection path
 * @param {string} collectionConfig.typesenseCollection - The Typesense collection name
 * @param {Array} collectionConfig.firestoreFields - Fields to sync (empty array for all fields)
 * @param {Object} typesense - Typesense client instance
 * @param {string} [specificPath] - Optional specific path to sync (for custom paths that match patterns)
 */
async function syncCollection(collectionConfig, typesense, specificPath = null) {
  const pathToSync = specificPath || collectionConfig.firestorePath;

  info(
    "Syncing " +
      `${collectionConfig.firestoreFields.length > 0 ? collectionConfig.firestoreFields.join(",") : "all"} fields in Firestore documents ` +
      `from ${pathToSync} ` +
      `into Typesense Collection ${collectionConfig.typesenseCollection}`,
  );

  const pathSegments = pathToSync.split("/").filter(Boolean);
  const pathPlaceholders = utils.parseFirestorePath(pathToSync);
  const isGroupQuery = pathSegments.length > 1 && pathToSync.includes("*");

  let querySnapshot;
  if (isGroupQuery) {
    const collectionGroup = pathSegments[pathSegments.length - 1];
    querySnapshot = admin.firestore().collectionGroup(collectionGroup);
  } else {
    querySnapshot = admin.firestore().collection(pathToSync);
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

          if (config.shouldLogTypesenseInserts) {
            debug(`Syncing document ${JSON.stringify(typesenseDocument)}`);
          }
          return typesenseDocument;
        }),
      )
    ).filter((doc) => doc !== null);

    lastDoc = thisBatch.docs.at(-1) ?? null;
    try {
      await typesense.collections(encodeURIComponent(collectionConfig.typesenseCollection)).documents().import(currentDocumentsBatch, {action: "upsert", return_id: true});
      totalImported += currentDocumentsBatch.length;
      info(`Imported ${currentDocumentsBatch.length} documents into Typesense collection ${collectionConfig.typesenseCollection} (total: ${totalImported})`);
    } catch (err) {
      error(`Import error in a batch of documents from ${currentDocumentsBatch[0]?.id} to ${lastDoc?.id} for collection ${collectionConfig.typesenseCollection}`, err);
      if ("importResults" in err) {
        logImportErrors(err.importResults);
      }
    }

    if (currentDocumentsBatch.length < config.typesenseBackfillBatchSize) {
      break;
    }
    // Recurse on the next process tick, to avoid
    // issues with the event loop on firebase functions related to resource release
    await new Promise((resolve) => process.nextTick(resolve));
  } while (lastDoc);

  info(`Done syncing ${totalImported} documents from ${pathToSync} to Typesense collection ${collectionConfig.typesenseCollection}`);
}

/**
 * Process a custom path which could be a collection or specific document
 * @param {string} path - The path to process
 * @param {Object} typesense - Typesense client instance
 */
async function processCustomPath(path, typesense) {
  // Trim any whitespace
  path = path.trim();

  if (!path) {
    return;
  }

  // Find matching collection configuration
  const matchingConfig = findMatchingCollectionConfig(path);

  if (!matchingConfig) {
    error(`Path "${path}" does not match any configured collection in COLLECTIONS_CONFIG. Skipping.`);
    return;
  }

  // Determine if it's a document or collection path
  const segments = path.split("/").filter(Boolean);
  const isDocumentPath = segments.length % 2 === 0;

  if (isDocumentPath) {
    // This is a specific document
    await syncDocument(path, matchingConfig, typesense);
  } else {
    // This is a collection or subcollection
    // If the path exactly matches the config or if it's a specific instance of a wildcard pattern
    await syncCollection(matchingConfig, typesense, path);
  }
}

module.exports = onDocumentCreated("typesense_manual_sync/{documentId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const triggerData = snapshot.data();
  info(`Manual sync triggered by document ${event.params.documentId}`);

  const typesense = createTypesenseClient();

  // Check for custom paths in the trigger document
  const customPaths = triggerData.paths;

  if (Array.isArray(customPaths) && customPaths.length > 0) {
    // Process custom paths sequentially
    info(`Processing ${customPaths.length} custom paths sequentially`);

    for (const path of customPaths) {
      try {
        await processCustomPath(path, typesense);
      } catch (err) {
        error(`Failed to process custom path: ${path}`, err);
        // Continue to next path even if one fails
      }
    }

    info("Done processing all custom paths");
  } else {
    // No custom paths specified, sync all configured collections
    if (config.collectionsConfig && config.collectionsConfig.length > 0) {
      info(`Syncing all ${config.collectionsConfig.length} configured collections sequentially`);

      // Process each collection sequentially
      for (const collectionConfig of config.collectionsConfig) {
        try {
          await syncCollection(collectionConfig, typesense);
        } catch (err) {
          error(`Failed to sync collection ${collectionConfig.firestorePath}`, err);
          // Continue to next collection even if one fails
        }
      }

      info("Done syncing all configured collections to Typesense");
    } else if (config.firestoreCollectionPath) {
      // Fallback to legacy single collection config for backward compatibility
      info(
        "Using legacy single collection configuration. Syncing " +
          `${config.firestoreCollectionFields.join(",")} fields in Firestore documents ` +
          `from ${config.firestoreCollectionPath} ` +
          `into Typesense Collection ${config.typesenseCollectionName}`,
      );

      const legacyConfig = {
        firestorePath: config.firestoreCollectionPath,
        typesenseCollection: config.typesenseCollectionName,
        firestoreFields: config.firestoreCollectionFields,
      };

      await syncCollection(legacyConfig, typesense);
    } else {
      error("No collection configuration found. Please configure either COLLECTIONS_CONFIG or the legacy FIRESTORE_COLLECTION_PATH.");
      return false;
    }
  }
});

/**
 * Log import errors, if any.
 * @param {Typesense.ImportError} importResults
 */
function logImportErrors(importResults) {
  importResults.forEach((result) => {
    if (result.success) return;

    error(`Error importing document with error: ${result.error}`, result);
  });
}