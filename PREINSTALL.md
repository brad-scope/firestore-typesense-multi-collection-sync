Use this extension to sync data from multiple Firestore collections to [Typesense](https://typesense.org/), enabling
full-text fuzzy search on your Firestore data with typo tolerance, faceting, filtering, sorting, curation, synonyms,
geosearch and more.

This extension listens to all configured Firestore collections and syncs documents to Typesense on creation, updates
and deletes. It supports multiple collections from a single installation, manual syncing of specific paths, and
optional scheduled syncs.

#### Additional setup

Before installing this extension, make sure that you have:

1. [Set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.
2. [Setup](https://typesense.org/docs/guide/install-typesense.html) a Typesense cluster
  (on [Typesense Cloud](https://cloud.typesense.org) or a Self-Hosted server).
3. Create Typesense Collections for each Firestore collection you want to sync, either through the Typesense Cloud
  dashboard or through the [API](https://typesense.org/docs/api/collections.html#create-a-collection).
4. Prepare your collections configuration JSON that defines which collections to sync.

This extension will sync changes that happen _after_ you've installed the extension. You can trigger manual syncs
to import existing data or sync specific collections/documents. You can also configure scheduled syncs to run
periodically. Detailed instructions will be provided after installation.

#### Billing

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
    - Cloud Firestore
    - Cloud Functions (Node.js 14+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))
    - Cloud Scheduler (optional - only if scheduled syncs are enabled)
- Usage of this extension also requires you to have a running Typesense cluster either on Typesense Cloud or some
  self-hosted server. You are responsible for any associated costs with these services.

#### Important Notes

- This extension does NOT create Typesense collections automatically. You must create them before installation.
- The extension supports both wildcard syntaxes for subcollections: `products/*/reviews` and `products/{productId}/reviews`
- Multiple Firestore collections can be synced from a single extension installation
