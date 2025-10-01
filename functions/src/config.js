// Parse collections configuration from JSON
let collectionsConfig = [];
const rawConfig = process.env.COLLECTIONS_CONFIG;
console.log(`[CONFIG] Raw COLLECTIONS_CONFIG: ${rawConfig}`);

try {
  collectionsConfig = JSON.parse(rawConfig || "[]");
  console.log(`[CONFIG] Parsed ${collectionsConfig.length} collection configurations`);

  // Ensure each collection has required fields and defaults
  collectionsConfig = collectionsConfig.map((config, index) => {
    console.log(`[CONFIG] Collection ${index + 1}: firestorePath=${config.firestorePath}, typesenseCollection=${config.typesenseCollection}, fields=${config.firestoreFields ? config.firestoreFields.length : 0}`);
    return {
      firestorePath: config.firestorePath,
      typesenseCollection: config.typesenseCollection,
      firestoreFields: config.firestoreFields || [],
    };
  });
} catch (error) {
  console.error("[CONFIG ERROR] Failed to parse COLLECTIONS_CONFIG:", error);
  console.error("[CONFIG ERROR] Raw config was:", rawConfig);
  collectionsConfig = [];
}

// Log all important config values
console.log(`[CONFIG] Batch size: 1000`);
console.log(`[CONFIG] Should flatten nested documents: ${process.env.FLATTEN_NESTED_DOCUMENTS === "true"}`);
console.log(`[CONFIG] Should include Firestore path: ${process.env.INCLUDE_FIRESTORE_PATH === "true"}`);
console.log(`[CONFIG] Dirty values handling: ${process.env.DIRTY_VALUES || "coerce_or_drop"}`);
console.log(`[CONFIG] Scheduled sync interval: ${process.env.SCHEDULED_SYNC_INTERVAL}`);
console.log(`[CONFIG] Typesense hosts: ${process.env.TYPESENSE_HOSTS}`);

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
  dirtyValues: process.env.DIRTY_VALUES || "coerce_or_drop",
  typesenseHosts: (process.env.TYPESENSE_HOSTS || "").split(",").map((e) => e.trim()),
  typesensePort: process.env.TYPESENSE_PORT || 443,
  typesenseProtocol: process.env.TYPESENSE_PROTOCOL || "https",
  typesenseAPIKey: process.env.TYPESENSE_API_KEY,
  typesenseManualSyncCollection: "typesense_manual_sync",
  typesenseBackfillBatchSize: 1000,
  scheduledSyncInterval: process.env.SCHEDULED_SYNC_INTERVAL,
};
