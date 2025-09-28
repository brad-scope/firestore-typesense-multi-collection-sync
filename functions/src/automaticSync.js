const {debug, info} = require("firebase-functions/logger");
const config = require("./config.js");
const utils = require("./utils.js");
const createTypesenseClient = require("./createTypesenseClient.js");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");

/**
 * Check if a document path matches a configured collection pattern
 * @param {string} documentPath - The full document path
 * @param {string} pattern - The collection pattern (may include wildcards)
 * @returns {Object|null} - Matched parameters or null if no match
 */
function matchCollectionPattern(documentPath, pattern) {
  // Convert the pattern to a regex
  // Replace * wildcards with [^/]+ to match any segment except /
  // Escape other special regex characters
  const regexPattern = pattern
    .split("/")
    .map((segment) => {
      if (segment === "*") {
        return "[^/]+";
      }
      // Escape special regex characters
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");

  const regex = new RegExp(`^${regexPattern}(/[^/]+)?$`);
  const match = documentPath.match(regex);

  if (match) {
    // Extract parameters from the path
    const pathSegments = documentPath.split("/");
    const patternSegments = pattern.split("/");
    const params = {};

    patternSegments.forEach((segment, index) => {
      if (segment === "*" && pathSegments[index]) {
        params[`param${Object.keys(params).length}`] = pathSegments[index];
      }
    });

    // Add the document ID
    if (pathSegments.length > patternSegments.length) {
      params.docId = pathSegments[pathSegments.length - 1];
    }

    return params;
  }

  return null;
}

exports.automaticSync = onDocumentWritten("{path=**}", async (event) => {
  const documentPath = event.document;
  const snapshot = event;

  // Check if we're using the new multi-collection config
  if (config.collectionsConfig && config.collectionsConfig.length > 0) {
    // Find matching collection configuration
    let matchedConfig = null;
    let matchedParams = null;

    for (const collectionConfig of config.collectionsConfig) {
      const params = matchCollectionPattern(documentPath, collectionConfig.firestorePath);
      if (params) {
        matchedConfig = collectionConfig;
        matchedParams = params;
        break;
      }
    }

    if (!matchedConfig) {
      // Document doesn't match any configured collection, exit early
      debug(`Document ${documentPath} doesn't match any configured collection, skipping`);
      return;
    }

    info(`Processing document ${documentPath} for collection ${matchedConfig.typesenseCollection}`);

    const typesense = createTypesenseClient();

    if (snapshot.data.after.data() == null) {
      // Delete
      const documentId = matchedParams.docId || snapshot.data.before.id;
      debug(`Deleting document ${documentId} from ${matchedConfig.typesenseCollection}`);
      try {
        return await typesense
          .collections(encodeURIComponent(matchedConfig.typesenseCollection))
          .documents(encodeURIComponent(documentId))
          .delete();
      } catch (error) {
        if (error.httpStatus === 404) {
          debug(`Document ${documentId} not found in Typesense, skipping delete`);
          return;
        }
        throw error;
      }
    } else {
      // Create / update
      const latestSnapshot = await snapshot.data.after.ref.get();
      const typesenseDocument = await utils.typesenseDocumentFromSnapshot(
        latestSnapshot,
        matchedParams,
        matchedConfig.firestoreFields
      );

      if (config.shouldLogTypesenseInserts) {
        debug(`Upserting document ${JSON.stringify(typesenseDocument)} to ${matchedConfig.typesenseCollection}`);
      } else {
        debug(`Upserting document ${typesenseDocument.id} to ${matchedConfig.typesenseCollection}`);
      }
      return await typesense
        .collections(encodeURIComponent(matchedConfig.typesenseCollection))
        .documents()
        .upsert(typesenseDocument);
    }
  } else if (config.firestoreCollectionPath) {
    // Fallback to legacy single collection config for backward compatibility
    const params = matchCollectionPattern(documentPath, config.firestoreCollectionPath);
    if (!params) {
      debug(`Document ${documentPath} doesn't match configured collection ${config.firestoreCollectionPath}, skipping`);
      return;
    }

    const typesense = createTypesenseClient();

    if (snapshot.data.after.data() == null) {
      // Delete
      const documentId = params.docId || snapshot.data.before.id;
      debug(`Deleting document ${documentId}`);
      return await typesense
        .collections(encodeURIComponent(config.typesenseCollectionName))
        .documents(encodeURIComponent(documentId))
        .delete();
    } else {
      // Create / update
      const latestSnapshot = await snapshot.data.after.ref.get();
      const typesenseDocument = await utils.typesenseDocumentFromSnapshot(latestSnapshot, params);

      if (config.shouldLogTypesenseInserts) {
        debug(`Upserting document ${JSON.stringify(typesenseDocument)}`);
      } else {
        debug(`Upserting document ${typesenseDocument.id}`);
      }
      return await typesense
        .collections(encodeURIComponent(config.typesenseCollectionName))
        .documents()
        .upsert(typesenseDocument);
    }
  } else {
    debug("No collection configuration found, skipping");
    return;
  }
});