### Post-installation Notes

Your Firestore Typesense Multi-Collection Sync extension is now installed and ready to sync your configured collections
to Typesense.

### ⚠️ Required Manual Configuration (Cloud Functions v2)

Due to a known limitation with Firebase Extensions using Cloud Functions v2, you need to **manually grant IAM permissions** for the extension to work. By default, the functions are configured to require authentication, but the necessary service accounts don't have permission to invoke them.

**You have two options:**

#### Option A: Quick Setup (Allow Public Access)
1. Go to the [Cloud Run console](https://console.cloud.google.com/run)
2. For each of these services, click on it and go to the "Security" tab:
   - `ext-firestore-typesense-multi-sync-automatic_sync`
   - `ext-firestore-typesense-multi-sync-manual_sync`
   - `ext-firestore-typesense-multi-sync-scheduled_sync`
3. Select "Allow unauthenticated invocations"
4. Click "Save"

⚠️ **Note:** This makes the Cloud Run endpoints publicly accessible, though they still require proper event payloads to trigger.

#### Option B: Secure Setup (Grant Specific IAM Permissions)
Manually grant the Cloud Run Invoker role to the appropriate service accounts:

For `automatic_sync` and `manual_sync`:
```bash
gcloud run services add-iam-policy-binding ext-firestore-typesense-multi-sync-automatic_sync \
  --region=YOUR_REGION \
  --member="serviceAccount:eventarc-trigger@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

gcloud run services add-iam-policy-binding ext-firestore-typesense-multi-sync-manual_sync \
  --region=YOUR_REGION \
  --member="serviceAccount:eventarc-trigger@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

For `scheduled_sync`:
```bash
gcloud run services add-iam-policy-binding ext-firestore-typesense-multi-sync-scheduled_sync \
  --region=YOUR_REGION \
  --member="serviceAccount:scheduler-trigger@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Replace `YOUR_REGION` with your function's region (e.g., `us-central1`) and `YOUR_PROJECT_ID` with your Firebase project ID.

**Note:** This is a one-time setup after installation or updates. We're working on automating this step in future versions.

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

- [Extension Documentation](https://github.com/inspect-scope/firestore-typesense-multi-sync)
- [Report Issues](https://github.com/inspect-scope/firestore-typesense-multi-sync/issues)
- [Typesense Documentation](https://typesense.org/docs/)