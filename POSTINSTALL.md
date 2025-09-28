### Post-installation Notes

Your Firestore Typesense Multi-Collection Sync extension is now installed and ready to sync your configured collections
to Typesense.

### Configuration Summary

The extension is configured to sync the following collections:
```
${param:COLLECTIONS_CONFIG}
```

Documents will be synced to Typesense at: `${param:TYPESENSE_HOSTS}`

### Syncing Existing Data

This extension only syncs data that is created or changed after installation. To sync existing documents, you have
several options:

#### Option 1: Sync All Configured Collections
1. Open the Firebase Console
2. Navigate to your Firestore database
3. Create a new document in the `typesense_manual_sync` collection with any ID
4. Set the document content to: `{timestamp: new Date()}`

This will trigger a sync of ALL configured collections.

#### Option 2: Sync Specific Paths
Create a document in `typesense_manual_sync` with specific paths:
```javascript
{
  paths: [
    "users",                          // Entire users collection
    "users/user123",                  // Specific user document
    "products/prod456/reviews"        // Subcollection
  ],
  timestamp: new Date()
}
```

The sync operation will update the trigger document with status information including:
- `syncStatus`: Current status (in_progress, completed, completed_with_errors, failed)
- `syncResults`: Detailed results including document counts and any errors
- `syncDuration`: Time taken to complete the sync

### Scheduled Syncs

${param:SCHEDULED_SYNC_INTERVAL === "never"
  ? "Scheduled syncs are currently disabled. You can reconfigure the extension to enable periodic syncs."
  : `Scheduled syncs are configured to run: ${param:SCHEDULED_SYNC_INTERVAL}`}

### Testing the Extension

Try adding or updating a document in one of your configured collections. You should see the changes reflected in your
Typesense collection immediately.

For example, if you configured the `users` collection, try:
1. Navigate to the Firestore console
2. Add or update a document in the `users` collection
3. Check your Typesense dashboard to see the synced document

### Monitoring

You can monitor the extension's activity through:

1. **Cloud Functions Logs**: View real-time logs in the [Cloud Functions console](https://console.cloud.google.com/functions)
2. **Extension Logs**: Check the extension's logs in the Firebase console
3. **Sync Status**: Monitor `typesense_manual_sync` documents for sync progress and results

### Important Notes

- The extension preserves existing `id` fields by backing them up to `_id`
- Firestore document IDs become the Typesense document `id`
${param:INCLUDE_FIRESTORE_PATH === "true"
  ? "- Document paths are included in the `_path` field"
  : "- Document paths are not being tracked (can be enabled by reconfiguring)"}
- Only fields specified in `firestoreFields` are synced (empty array syncs all fields)

### Troubleshooting

If documents aren't syncing:
1. Ensure the Typesense collection exists (this extension doesn't create collections)
2. Check that the document path matches a configured collection pattern
3. Verify your Typesense API key has write permissions
4. Review the Cloud Functions logs for any errors

### Next Steps

- Set up search queries in your application using the [Typesense JavaScript client](https://github.com/typesense/typesense-js)
- Configure search UI components with [Typesense InstantSearch](https://github.com/typesense/typesense-instantsearch-adapter)
- Explore [Typesense features](https://typesense.org/docs/) like faceting, filtering, and synonyms

### Support

- [Extension Documentation](https://github.com/brad-scope/firestore-typesense-multi-collection-sync)
- [Report Issues](https://github.com/brad-scope/firestore-typesense-multi-collection-sync/issues)
- [Typesense Documentation](https://typesense.org/docs/)