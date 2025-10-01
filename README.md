# Firestore Typesense Multi-Sync Extension 🔄 🔍

An enhanced Firebase extension for syncing multiple Firestore collections to [Typesense](https://typesense.org/), enabling full-text fuzzy search on your Firestore data with typo tolerance, faceting, filtering, sorting, curation, synonyms, geosearch and more.

This extension is a fork and enhancement of the [original Typesense Firebase extension](https://github.com/typesense/firestore-typesense-search), modified by [Brad Mallow](https://github.com/briznad) at [Scope Inspections](https://getscope.ai) to better support multi-collection synchronization and additional configuration options.

## 🎯 Key Enhancements

This enhanced version adds several critical features not available in the original extension:

- **🔄 Multi-Collection Support**: Sync multiple Firestore collections from a single extension installation
- **📝 JSON Configuration**: Define all collections in one JSON configuration parameter
- **🎯 Selective Manual Sync**: Manually sync specific documents or collections on demand
- **🆔 ID Field Preservation**: Preserves existing `id` fields by backing them up to `_id`
- **📍 Path Tracking**: Optional `_path` field to track source Firestore document paths
- **⚡ Improved Performance**: Single wildcard trigger with efficient path matching
- **🔗 Subcollection Support**: Full support for nested subcollections with wildcard patterns

## 📋 Prerequisites

Before installing this extension, ensure you have:

1. **A Cloud Firestore database** set up in your Firebase project
   - For Google Workspace for Business users, ensure your default cloud compute service account has these IAM roles:
     - Artifact Registry Administrator
     - Artifact Registry Create-on-Push Writer
     - Artifact Registry Service Agent
     - Logs Writer
     - Storage Object Viewer

2. **A Typesense cluster** either on:
   - [Typesense Cloud](https://cloud.typesense.org) (managed service)
   - [Self-Hosted](https://typesense.org/docs/guide/install-typesense.html) (free)

3. **Pre-created Typesense Collections** for each Firestore collection you want to sync
   > ⚠️ **Important**: This extension does NOT create Typesense collections automatically. You must create them via the Typesense dashboard or API before installing.

## 🚀 Installation

### Via Firebase Console

```bash
firebase ext:install inspect-scope/firestore-typesense-multi-sync
```

### Via Firebase CLI

```bash
firebase ext:install inspect-scope/firestore-typesense-multi-sync --project=[your-project-id]
```

## ⚙️ Configuration

### Collections Configuration (COLLECTIONS_CONFIG)

The most important configuration parameter. Define all collections to sync in a JSON array:

```json
[
  {
    "firestorePath": "users",
    "typesenseCollection": "users_index",
    "firestoreFields": ["name", "email", "createdAt"]
  },
  {
    "firestorePath": "products/*/reviews",
    "typesenseCollection": "reviews_index",
    "firestoreFields": []
  },
  {
    "firestorePath": "products/{productId}/reviews",
    "typesenseCollection": "reviews_index_alt",
    "firestoreFields": []
  },
  {
    "firestorePath": "orders",
    "typesenseCollection": "orders_search",
    "firestoreFields": ["orderNumber", "customer", "total", "status"]
  }
]
```

**Configuration Properties:**
- `firestorePath`: The Firestore collection path (supports wildcards - see below)
- `typesenseCollection`: Target Typesense collection name (must already exist)
- `firestoreFields`: Array of fields to sync (empty array `[]` syncs all fields)

### 🔗 Subcollection Support & Wildcard Patterns

This extension fully supports subcollections using wildcard patterns. Wildcards are **required** for subcollections to work properly.

#### Supported Wildcard Syntaxes

Both wildcard syntaxes are supported and functionally equivalent:

1. **Asterisk Wildcard (`*`)**:
   ```json
   "firestorePath": "products/*/reviews"
   ```

2. **Parameter Wildcard (`{paramName}`)**:
   ```json
   "firestorePath": "products/{productId}/reviews"
   ```

#### Path Examples

| Path Pattern | Type | Description |
|--------------|------|-------------|
| `users` | Collection | Top-level collection |
| `products/*/reviews` | Subcollection | All reviews across all products |
| `tenants/{tenantId}/users` | Subcollection | Users within each tenant |
| `categories/*/items/*/variants` | Nested Subcollection | Multiple wildcard levels |
| `users/user123` | Document | Specific document (manual sync only) |
| `products/prod456/reviews/rev789` | Document | Specific nested document (manual sync only) |

#### How Subcollections Work

- **Automatic Detection**: The extension automatically detects whether a path refers to a collection or document based on segment count:
  - Odd segments = Collection or subcollection (e.g., `users`, `products/*/reviews`)
  - Even segments = Document (e.g., `users/user123`, `products/prod456/reviews/rev789`)

- **Collection Group Queries**: When a wildcard pattern is detected in subcollections, the extension uses Firestore's collection group queries to efficiently find all matching documents across the hierarchy.

- **Pattern Matching**: The extension validates that documents match the configured pattern before syncing, ensuring only intended documents are processed.

### All Configuration Parameters

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| **COLLECTIONS_CONFIG** | JSON array of collection configurations | Yes | - |
| **TYPESENSE_HOSTS** | Comma-separated list of Typesense hostnames (without protocol or port) | Yes | - |
| **TYPESENSE_API_KEY** | Typesense API key with admin permissions | Yes | - |
| **Cloud Functions location** | Deployment region for the functions | Yes | us-central1 |
| **Firestore Database region** | Region of your Firestore database | Yes | nam5 |
| **DATABASE** | Firestore database name | No | (default) |
| **FLATTEN_NESTED_DOCUMENTS** | Flatten nested objects for Typesense <0.24 | No | false |
| **DIRTY_VALUES** | How to handle data type mismatches ([docs](https://typesense.org/docs/29.0/api/documents.html#dealing-with-dirty-data)) | No | coerce_or_drop |
| **LOG_TYPESENSE_INSERTS** | Log inserted documents for debugging | No | false |
| **INCLUDE_FIRESTORE_PATH** | Include `_path` field with Firestore document path | No | false |
| **SCHEDULED_SYNC_INTERVAL** | Automatic sync schedule (cron expression or predefined interval) | No | never |

### Dirty Values Handling (DIRTY_VALUES)

Controls how Typesense handles documents with field values that don't match the expected schema type. This helps minimize data loss when your Firestore data doesn't perfectly match your Typesense schema.

| Value | Behavior |
|-------|----------|
| `coerce_or_drop` (default) | Attempts to convert the value to the expected type. If conversion fails, drops that field but indexes the rest of the document. **Recommended for minimal data loss.** |
| `coerce_or_reject` | Attempts to convert the value. If conversion fails, rejects the entire document with an error. |
| `drop` | Immediately drops fields with type mismatches without attempting conversion. |
| `reject` | Rejects any document with type mismatches. |

**Example:** If your Typesense schema expects `age` to be an integer but Firestore has `age: "25"` (string):
- `coerce_or_drop`: Converts `"25"` → `25` and indexes the document
- `coerce_or_reject`: Converts `"25"` → `25` and indexes the document
- `drop`: Drops the `age` field but indexes the rest
- `reject`: Rejects the entire document

📖 **Learn more:** [Typesense Dirty Data Documentation](https://typesense.org/docs/29.0/api/documents.html#dealing-with-dirty-data)

### Typesense Connection Requirements

⚠️ This extension only supports HTTPS connections on port 443 for security:
- **Typesense Cloud**: Already configured with HTTPS
- **Self-Hosted**: Configure with `--api-port=443` and SSL certificates
- **Local Development**: Use ngrok or similar (`ngrok http 8108`)

## 🔄 How It Works

### Automatic Sync (`automatic_sync`)

Triggers automatically on any document change in configured collections:
- **Create**: Adds new documents to Typesense
- **Update**: Updates existing documents in Typesense
- **Delete**: Removes documents from Typesense

The function uses a wildcard trigger (`{path=**}`) and efficiently filters for configured collections.

### Manual Sync (`manual_sync`)

Triggered by creating a document in the `typesense_manual_sync` collection.

#### Sync All Configured Collections
```javascript
// Creates a document that triggers sync of all collections
// No fields are required - an empty document works
db.collection('typesense_manual_sync').add({});

// Optional: include a timestamp for your own tracking
db.collection('typesense_manual_sync').add({
  timestamp: new Date()  // Optional field
});
```

#### Sync Specific Paths
```javascript
db.collection('typesense_manual_sync').add({
  paths: [
    "users",                          // Entire users collection
    "users/user123",                  // Specific user document
    "products/prod456/reviews",       // All reviews for product prod456
    "products/prod789/reviews/rev001" // Specific review document
  ]
});
```

**Important Notes:**
- Paths must match collections defined in `COLLECTIONS_CONFIG`
- Unmatched paths are skipped with an error message
- Processing is sequential to ensure order
- Document ID in `typesense_manual_sync` can be anything

#### Sync Status Tracking

The trigger document is automatically updated with metadata during the sync process:

**Status Fields Added:**
- `syncStatus`: Current status (`in_progress`, `completed`, `completed_with_errors`, `failed`)
- `syncStartedAt`: Timestamp when sync began
- `syncCompletedAt`: Timestamp when sync finished
- `syncDuration`: Total time taken (e.g., "45.2s")
- `syncError`: Error message if sync failed or had errors
- `syncResults`: Detailed results object containing:
  - `paths`: Results for each custom path synced
  - `collections`: Results for each collection synced
  - `totalDocuments`: Total number of documents processed
  - `totalErrors`: Total number of errors encountered
  - `success`: Boolean indicating overall success

**Example: Monitoring Sync Progress**
```javascript
// Create trigger document and get reference
const docRef = await db.collection('typesense_manual_sync').add({
  paths: ["users", "products"]
});

// Monitor the document for updates
docRef.onSnapshot((snapshot) => {
  const data = snapshot.data();
  console.log('Sync Status:', data.syncStatus);

  if (data.syncStatus === 'completed') {
    console.log('Documents synced:', data.syncResults.totalDocuments);
    console.log('Duration:', data.syncDuration);
  }
});
```

### Scheduled Sync (`scheduled_sync`)

Automatically syncs all configured collections at predefined intervals.

**Configuration Options:**
- Never (disabled) - default
- Every 15, 30 minutes
- Every 1, 2, 6, 12 hours
- Daily at midnight or 2 AM
- Weekly on Sunday at 2 AM

**Example Configuration:**
Set `SCHEDULED_SYNC_INTERVAL` during installation to one of:
- `never` - Disabled (default)
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 2 * * 0` - Weekly on Sunday at 2 AM

**Notes:**
- Syncs ALL collections defined in `COLLECTIONS_CONFIG`
- Runs sequentially to avoid overwhelming the system
- Includes retry logic with exponential backoff
- Logs detailed progress in Cloud Functions logs

## 🔍 Special Fields

### ID Field Handling

The extension intelligently handles ID fields:
- Firestore document ID → Typesense `id` field
- Existing `id` field in data → Preserved as `_id`

**Example:**
```javascript
// Firestore document
Path: users/user123
Data: { name: "John", id: "employee456" }

// Typesense document
{
  id: "user123",        // Firestore document ID
  _id: "employee456",   // Original id field preserved
  name: "John"
}
```

### Path Field (Optional)

When `INCLUDE_FIRESTORE_PATH` is enabled:
```javascript
// Typesense document includes
{
  // ... other fields
  _path: "users/user123"  // Full Firestore path
}
```

## 📊 Use Cases

### 1. E-commerce Platform
```json
[
  {
    "firestorePath": "products",
    "typesenseCollection": "products_search",
    "firestoreFields": ["name", "description", "price", "category"]
  },
  {
    "firestorePath": "products/{productId}/reviews",
    "typesenseCollection": "reviews_search",
    "firestoreFields": ["rating", "comment", "userId", "createdAt"]
  },
  {
    "firestorePath": "categories/*/products",
    "typesenseCollection": "categorized_products",
    "firestoreFields": []
  }
]
```

### 2. Multi-tenant SaaS
```json
[
  {
    "firestorePath": "tenants/{tenantId}/users",
    "typesenseCollection": "all_users_search",
    "firestoreFields": ["email", "name", "role", "tenantId"]
  },
  {
    "firestorePath": "tenants/{tenantId}/projects/{projectId}/tasks",
    "typesenseCollection": "all_tasks_search",
    "firestoreFields": ["title", "description", "assignee", "status"]
  },
  {
    "firestorePath": "tenants/*/documents",
    "typesenseCollection": "all_documents_search",
    "firestoreFields": ["title", "content", "tags", "tenantId"]
  }
]
```

### 3. Content Management
```json
[
  {
    "firestorePath": "articles",
    "typesenseCollection": "articles_search",
    "firestoreFields": ["title", "content", "author", "publishedAt"]
  },
  {
    "firestorePath": "authors",
    "typesenseCollection": "authors_search",
    "firestoreFields": ["name", "bio", "expertise"]
  }
]
```

## 🔧 Development & Testing

### Local Development
```bash
# Start emulators
npm run emulator
npm run typesenseServer

# Run tests
npm test

# Specific test suites
npm run test:flattened
npm run test:unflattened
npm run test:subcollection
```

### Code Quality
```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## 🐛 Troubleshooting

### Common Issues

**1. HTTP 404 Errors**
- Cause: Typesense collection doesn't exist
- Solution: Create the collection in Typesense before syncing

**2. Documents Not Syncing**
- Check if the path matches a configured collection
- For subcollections, ensure you're using wildcard syntax (`*` or `{paramName}`)
- Verify field names match between Firestore and Typesense schema
- Check extension logs for validation errors

**3. Manual Sync Not Triggering**
- Ensure document is created in `typesense_manual_sync` collection
- Check that paths match exactly with configured collections
- For subcollections, wildcards in the configuration will match specific parent IDs in manual sync paths
- Verify the extension has proper permissions

**4. Missing Fields in Typesense**
- Check `firestoreFields` configuration
- Empty array `[]` syncs all fields
- Specified fields array limits to those fields only

## 📝 Migration from Original Extension

If migrating from the original Typesense extension:

1. **Export your configuration** from the old extension
2. **Create the JSON configuration** for COLLECTIONS_CONFIG
3. **Uninstall the old extensions** (if you had multiple for different collections)
4. **Install this extension** with the new configuration
5. **Run manual sync** to ensure all documents are in sync

## 🤝 Contributing

This is an open-source project. Contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

Apache-2.0 License - see LICENSE file for details

## 🙏 Acknowledgments

- Original extension by [Typesense](https://typesense.org/)
- Enhanced by [Brad Mallow](https://github.com/briznad) at [Scope Inspections](https://getscope.ai)
- Built for the Firebase and Typesense community

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/inspect-scope/firestore-typesense-multi-sync/issues)
- **Original Extension**: [Typesense Firebase Extension](https://github.com/typesense/firestore-typesense-search)
- **Typesense Community**: [Slack](https://join.slack.com/t/typesense-community/shared_invite/zt-2fetvh0pw-ft5y2YQlq4l_bPhhqpjXig)

## 🔄 Changelog

### Version 1.0.0 (2024)
- Initial release of multi-collection sync enhancement
- Added JSON configuration for multiple collections
- Enhanced manual sync with custom paths support
- Added sync status tracking with real-time metadata updates
- Added ID field preservation
- Added optional path tracking
- Added scheduled sync functionality with configurable intervals
- Improved wildcard pattern matching with support for both `*` and `{paramName}` syntaxes
- Full subcollection support with collection group queries
- Sequential processing for reliability

---

*This extension is a third-party enhancement and is not officially maintained by Typesense. For the original extension, please visit the [official Typesense repository](https://github.com/typesense/firestore-typesense-search).*
