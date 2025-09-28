const firebase = require("firebase-admin");
const config = require("../functions/src/config.js");
const typesense = require("../functions/src/createTypesenseClient.js")();

const app = firebase.initializeApp({
  databaseURL: `${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${process.env.GCLOUD_PROJECT}`,
  projectId: process.env.GCLOUD_PROJECT,
});
const firestore = app.firestore();

describe("Enhanced Manual Sync", () => {
  beforeEach(async () => {
    // Clear manual sync collection
    await firestore.recursiveDelete(firestore.collection("typesense_manual_sync"));

    // Setup test collections if multi-collection config is present
    if (config.collectionsConfig && config.collectionsConfig.length > 0) {
      for (const collectionConfig of config.collectionsConfig) {
        // Clear Firestore collection (only if it's not a subcollection pattern)
        if (!collectionConfig.firestorePath.includes("*") && !collectionConfig.firestorePath.includes("{")) {
          await firestore.recursiveDelete(firestore.collection(collectionConfig.firestorePath));
        }

        // Clear and recreate Typesense collection
        try {
          await typesense.collections(encodeURIComponent(collectionConfig.typesenseCollection)).delete();
        } catch (e) {
          // Collection might not exist
        }

        await typesense.collections().create({
          name: collectionConfig.typesenseCollection,
          fields: [{ name: ".*", type: "auto" }],
          enable_nested_fields: true,
        });
      }
    }
  });

  afterAll(async () => {
    await app.delete();
  });

  describe("manual sync trigger mechanism", () => {
    it("should accept any document ID in typesense_manual_sync collection", async () => {
      // Create trigger documents with various IDs
      const docRef1 = await firestore.collection("typesense_manual_sync").add({
        timestamp: new Date(),
      });

      const docRef2 = await firestore.collection("typesense_manual_sync").doc("custom-id-123").set({
        timestamp: new Date(),
      });

      const docRef3 = await firestore.collection("typesense_manual_sync").doc("another-id").set({
        timestamp: new Date(),
      });

      // All documents should be valid triggers
      expect(docRef1.id).toBeTruthy();
      expect(docRef2.id).toBe("custom-id-123");
      expect(docRef3.id).toBe("another-id");
    });

    it("should update trigger document with sync status", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        timestamp: new Date(),
      });

      // Wait a moment for the function to process
      await new Promise((r) => setTimeout(r, 3000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      // Check for sync status fields
      expect(data.syncStatus).toBeDefined();
      expect(["in_progress", "completed", "completed_with_errors", "failed"]).toContain(data.syncStatus);
      expect(data.syncStartedAt).toBeDefined();
    });
  });

  describe("custom paths sync", () => {
    beforeEach(async () => {
      // Add test data to various collections
      await firestore.collection("users").doc("user1").set({
        name: "User 1",
        email: "user1@example.com",
      });

      await firestore.collection("users").doc("user2").set({
        name: "User 2",
        email: "user2@example.com",
      });

      await firestore.collection("products").doc("prod1").set({
        name: "Product 1",
        price: 100,
      });

      // Add subcollection data
      await firestore.collection("products").doc("prod1").collection("reviews").doc("rev1").set({
        rating: 5,
        comment: "Great product",
      });
    });

    it("should sync specific collections when paths array is provided", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["users"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults).toBeDefined();
      expect(data.syncResults.paths).toBeDefined();
      expect(data.syncResults.paths).toHaveLength(1);
      expect(data.syncResults.paths[0].path).toBe("users");
    });

    it("should sync specific documents when document paths are provided", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["users/user1", "products/prod1"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults).toBeDefined();
      expect(data.syncResults.paths).toHaveLength(2);
      expect(data.syncResults.paths[0].path).toBe("users/user1");
      expect(data.syncResults.paths[1].path).toBe("products/prod1");
    });

    it("should sync subcollections when subcollection paths are provided", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["products/prod1/reviews"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults).toBeDefined();
      expect(data.syncResults.paths).toHaveLength(1);
      expect(data.syncResults.paths[0].path).toBe("products/prod1/reviews");
    });

    it("should handle invalid paths gracefully", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["invalid/path/that/does/not/match"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults).toBeDefined();
      expect(data.syncResults.paths[0].success).toBe(false);
      expect(data.syncResults.paths[0].error).toContain("does not match");
    });
  });

  describe("sync metadata tracking", () => {
    it("should track sync duration", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncDuration).toBeDefined();
      expect(data.syncDuration).toMatch(/^\d+(\.\d+)?s$/); // Format: "X.Xs"
      expect(data.syncStartedAt).toBeDefined();
      expect(data.syncCompletedAt).toBeDefined();
    });

    it("should track document counts", async () => {
      // Add some test data
      await firestore.collection("users").doc("user1").set({ name: "Test 1" });
      await firestore.collection("users").doc("user2").set({ name: "Test 2" });

      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["users"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults.totalDocuments).toBeDefined();
      expect(data.syncResults.totalDocuments).toBeGreaterThan(0);
    });

    it("should track errors", async () => {
      const docRef = await firestore.collection("typesense_manual_sync").add({
        paths: ["non-existent-collection"],
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults.totalErrors).toBeDefined();
      expect(data.syncStatus).toMatch(/completed_with_errors|failed/);
    });
  });

  describe("sync all collections when no paths specified", () => {
    it("should sync all configured collections when paths array is not provided", async () => {
      if (!config.collectionsConfig || config.collectionsConfig.length === 0) {
        // Skip test if no multi-collection config
        return;
      }

      const docRef = await firestore.collection("typesense_manual_sync").add({
        timestamp: new Date(),
      });

      // Wait for sync to complete
      await new Promise((r) => setTimeout(r, 5000));

      const updatedDoc = await docRef.get();
      const data = updatedDoc.data();

      expect(data.syncResults).toBeDefined();
      expect(data.syncResults.collections).toBeDefined();
      expect(data.syncResults.collections.length).toBeGreaterThan(0);
    });
  });
});