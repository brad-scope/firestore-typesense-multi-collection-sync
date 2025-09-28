const config = require("../functions/src/config.js");
const utils = require("../functions/src/utils.js");

describe("Multi-Collection Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("collectionsConfig parsing", () => {
    it("should parse valid JSON configuration correctly", () => {
      const testConfig = JSON.stringify([
        {
          firestorePath: "users",
          typesenseCollection: "users_index",
          firestoreFields: ["name", "email"],
        },
        {
          firestorePath: "products/*/reviews",
          typesenseCollection: "reviews_index",
          firestoreFields: [],
        },
      ]);

      process.env.COLLECTIONS_CONFIG = testConfig;
      // Re-require to get fresh config with new env
      delete require.cache[require.resolve("../functions/src/config.js")];
      const freshConfig = require("../functions/src/config.js");

      expect(freshConfig.collectionsConfig).toHaveLength(2);
      expect(freshConfig.collectionsConfig[0].firestorePath).toBe("users");
      expect(freshConfig.collectionsConfig[0].typesenseCollection).toBe("users_index");
      expect(freshConfig.collectionsConfig[0].firestoreFields).toEqual(["name", "email"]);
      expect(freshConfig.collectionsConfig[1].firestoreFields).toEqual([]);
    });

    it("should handle invalid JSON gracefully", () => {
      process.env.COLLECTIONS_CONFIG = "invalid json";
      delete require.cache[require.resolve("../functions/src/config.js")];
      const freshConfig = require("../functions/src/config.js");

      expect(freshConfig.collectionsConfig).toEqual([]);
    });

    it("should handle missing COLLECTIONS_CONFIG", () => {
      delete process.env.COLLECTIONS_CONFIG;
      delete require.cache[require.resolve("../functions/src/config.js")];
      const freshConfig = require("../functions/src/config.js");

      expect(freshConfig.collectionsConfig).toEqual([]);
    });

    it("should provide default empty array for missing firestoreFields", () => {
      const testConfig = JSON.stringify([
        {
          firestorePath: "users",
          typesenseCollection: "users_index",
        },
      ]);

      process.env.COLLECTIONS_CONFIG = testConfig;
      delete require.cache[require.resolve("../functions/src/config.js")];
      const freshConfig = require("../functions/src/config.js");

      expect(freshConfig.collectionsConfig[0].firestoreFields).toEqual([]);
    });
  });

  describe("wildcard detection", () => {
    it("should detect asterisk wildcards", () => {
      expect(utils.hasWildcard("users/*/documents")).toBe(true);
      expect(utils.hasWildcard("products/*/reviews/*/comments")).toBe(true);
      expect(utils.hasWildcard("users")).toBe(false);
    });

    it("should detect parameter wildcards", () => {
      expect(utils.hasWildcard("users/{userId}/documents")).toBe(true);
      expect(utils.hasWildcard("products/{productId}/reviews")).toBe(true);
      expect(utils.hasWildcard("categories/{catId}/items/{itemId}")).toBe(true);
      expect(utils.hasWildcard("simple-collection")).toBe(false);
    });

    it("should detect mixed wildcard types", () => {
      expect(utils.hasWildcard("users/*/documents/{docId}")).toBe(true);
    });
  });

  describe("wildcard normalization", () => {
    it("should convert parameter wildcards to asterisks", () => {
      expect(utils.normalizeWildcards("users/{userId}/documents")).toBe("users/*/documents");
      expect(utils.normalizeWildcards("products/{productId}/reviews/{reviewId}")).toBe("products/*/reviews/*");
    });

    it("should leave asterisk wildcards unchanged", () => {
      expect(utils.normalizeWildcards("users/*/documents")).toBe("users/*/documents");
    });

    it("should handle paths without wildcards", () => {
      expect(utils.normalizeWildcards("users")).toBe("users");
      expect(utils.normalizeWildcards("simple/path")).toBe("simple/path");
    });

    it("should handle mixed wildcard types", () => {
      expect(utils.normalizeWildcards("users/{userId}/docs/*/items")).toBe("users/*/docs/*/items");
    });
  });

  describe("path matching", () => {
    it("should match simple collection paths", () => {
      const result = utils.pathMatchesSelector("users/user123", "users");
      expect(result).toBe(null); // Collection pattern shouldn't match document path

      const result2 = utils.pathMatchesSelector("users", "users");
      expect(result2).toEqual({});
    });

    it("should match paths with asterisk wildcards", () => {
      const result = utils.pathMatchesSelector("products/prod123/reviews/rev456", "products/*/reviews");
      expect(result).toEqual({ param0: "prod123" });
    });

    it("should match paths with parameter wildcards", () => {
      const result = utils.pathMatchesSelector("products/prod123/reviews/rev456", "products/{productId}/reviews");
      expect(result).toEqual({ productId: "prod123" });
    });

    it("should match multiple wildcards", () => {
      const result = utils.pathMatchesSelector(
        "tenants/tenant1/projects/proj2/tasks/task3",
        "tenants/{tenantId}/projects/{projectId}/tasks"
      );
      expect(result).toEqual({
        tenantId: "tenant1",
        projectId: "proj2",
      });
    });

    it("should return null for non-matching paths", () => {
      expect(utils.pathMatchesSelector("users/user123", "products")).toBe(null);
      expect(utils.pathMatchesSelector("short/path", "very/long/path/pattern")).toBe(null);
    });

    it("should handle mixed wildcard types correctly", () => {
      const result = utils.pathMatchesSelector("users/user123/docs/doc456", "users/*/docs/{docId}");
      expect(result).toEqual({
        param0: "user123",
        docId: "doc456",
      });
    });
  });

  describe("ID field preservation", () => {
    it("should preserve existing id field as _id", async () => {
      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          id: "existing-id",
          name: "Test",
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await utils.typesenseDocumentFromSnapshot(mockSnapshot, {}, []);
      expect(result._id).toBe("existing-id");
      expect(result.id).toBe("doc123");
    });

    it("should not create _id if no existing id field", async () => {
      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          name: "Test",
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await utils.typesenseDocumentFromSnapshot(mockSnapshot, {}, []);
      expect(result._id).toBeUndefined();
      expect(result.id).toBe("doc123");
    });
  });

  describe("optional path field", () => {
    it("should include _path when configured", async () => {
      process.env.INCLUDE_FIRESTORE_PATH = "true";
      delete require.cache[require.resolve("../functions/src/config.js")];
      delete require.cache[require.resolve("../functions/src/utils.js")];
      const freshUtils = require("../functions/src/utils.js");

      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          name: "Test",
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await freshUtils.typesenseDocumentFromSnapshot(mockSnapshot, {}, []);
      expect(result._path).toBe("users/doc123");
    });

    it("should not include _path when not configured", async () => {
      process.env.INCLUDE_FIRESTORE_PATH = "false";
      delete require.cache[require.resolve("../functions/src/config.js")];
      delete require.cache[require.resolve("../functions/src/utils.js")];
      const freshUtils = require("../functions/src/utils.js");

      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          name: "Test",
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await freshUtils.typesenseDocumentFromSnapshot(mockSnapshot, {}, []);
      expect(result._path).toBeUndefined();
    });
  });

  describe("field extraction with multi-collection config", () => {
    it("should extract only specified fields when firestoreFields is provided", async () => {
      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          name: "John",
          email: "john@example.com",
          password: "secret",
          age: 30,
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await utils.typesenseDocumentFromSnapshot(mockSnapshot, {}, ["name", "email"]);
      expect(result.name).toBe("John");
      expect(result.email).toBe("john@example.com");
      expect(result.password).toBeUndefined();
      expect(result.age).toBeUndefined();
    });

    it("should extract all fields when firestoreFields is empty", async () => {
      const mockSnapshot = {
        id: "doc123",
        data: () => ({
          name: "John",
          email: "john@example.com",
          age: 30,
        }),
        ref: {
          path: "users/doc123",
        },
      };

      const result = await utils.typesenseDocumentFromSnapshot(mockSnapshot, {}, []);
      expect(result.name).toBe("John");
      expect(result.email).toBe("john@example.com");
      expect(result.age).toBe(30);
    });
  });
});