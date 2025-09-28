// Parse collections configuration from JSON
let collectionsConfig = [];
try {
  collectionsConfig = JSON.parse(process.env.COLLECTIONS_CONFIG || "[]");
  // Ensure each collection has required fields and defaults
  collectionsConfig = collectionsConfig.map((config) => ({
    firestorePath: config.firestorePath,
    typesenseCollection: config.typesenseCollection,
    firestoreFields: config.firestoreFields || [],
  }));
} catch (error) {
  console.error("Failed to parse COLLECTIONS_CONFIG:", error);
  collectionsConfig = [];
}

module.exports = {
  // Legacy config for backward compatibility
  firestoreCollectionPath: process.env.FIRESTORE_COLLECTION_PATH,
  firestoreCollectionFields: (process.env.FIRESTORE_COLLECTION_FIELDS || "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f),
  typesenseCollectionName: process.env.TYPESENSE_COLLECTION_NAME,

  // New multi-collection config
  collectionsConfig,

  // Common Typesense settings
  shouldFlattenNestedDocuments: process.env.FLATTEN_NESTED_DOCUMENTS === "true",
  shouldLogTypesenseInserts: process.env.LOG_TYPESENSE_INSERTS === "true",
  shouldIncludeFirestorePath: process.env.INCLUDE_FIRESTORE_PATH === "true",
  typesenseHosts: (process.env.TYPESENSE_HOSTS || "").split(",").map((e) => e.trim()),
  typesensePort: process.env.TYPESENSE_PORT || 443,
  typesenseProtocol: process.env.TYPESENSE_PROTOCOL || "https",
  typesenseAPIKey: process.env.TYPESENSE_API_KEY,
  typesenseManualSyncCollection: "typesense_manual_sync",
  typesenseBackfillBatchSize: 1000,
};
