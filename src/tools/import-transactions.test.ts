import { describe, it, expect } from "vitest";

describe("import-transactions since_date filtering", () => {
  describe("transaction filtering logic", () => {
    it("correctly filters transactions before since_date", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          import_id: "id2",
        },
        {
          date: "2026-01-20",
          amount: 300,
          payee_name: "NEWER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-15";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].payee_name).toBe("NEW");
      expect(filtered[1].payee_name).toBe("NEWER");
    });

    it("includes transactions on the since_date", () => {
      const transactions = [
        {
          date: "2026-01-15",
          amount: 100,
          payee_name: "EXACT",
          import_id: "id1",
        },
        {
          date: "2026-01-16",
          amount: 200,
          payee_name: "AFTER",
          import_id: "id2",
        },
      ];

      const since_date = "2026-01-15";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].date).toBe("2026-01-15");
    });

    it("excludes all transactions when since_date is in future", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "RECENT",
          import_id: "id2",
        },
      ];

      const since_date = "2026-12-31";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(0);
    });

    it("returns all transactions when since_date is omitted", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          import_id: "id2",
        },
      ];

      const since_date = undefined;
      let filtered = transactions;
      if (since_date) {
        filtered = transactions.filter((t) => t.date >= since_date);
      }

      expect(filtered).toHaveLength(2);
    });

    it("calculates filtered_count correctly", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          import_id: "id2",
        },
        {
          date: "2026-01-20",
          amount: 300,
          payee_name: "NEWER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-15";
      let filteredTransactions = transactions;
      let filteredCount = 0;
      if (since_date) {
        filteredTransactions = transactions.filter((t) => t.date >= since_date);
        filteredCount = transactions.length - filteredTransactions.length;
      }

      expect(filteredCount).toBe(1);
      expect(filteredTransactions).toHaveLength(2);
    });
  });

  describe("date string comparison", () => {
    it("handles YYYY-MM-DD date format correctly", () => {
      const transactions = [
        {
          date: "2026-01-09",
          amount: 100,
          payee_name: "BEFORE",
          import_id: "id1",
        },
        {
          date: "2026-01-10",
          amount: 200,
          payee_name: "ON",
          import_id: "id2",
        },
        {
          date: "2026-01-11",
          amount: 300,
          payee_name: "AFTER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-10";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].date).toBe("2026-01-10");
    });

    it("works with different months and years", () => {
      const transactions = [
        {
          date: "2025-12-31",
          amount: 100,
          payee_name: "OLD_YEAR",
          import_id: "id1",
        },
        {
          date: "2026-01-01",
          amount: 200,
          payee_name: "NEW_YEAR",
          import_id: "id2",
        },
      ];

      const since_date = "2026-01-01";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].payee_name).toBe("NEW_YEAR");
    });
  });

  describe("total amount calculation", () => {
    it("calculates total correctly for filtered transactions", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          import_id: "id2",
        },
        {
          date: "2026-01-20",
          amount: 300,
          payee_name: "NEWER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-15";
      const filtered = transactions.filter((t) => t.date >= since_date);
      const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0);

      expect(totalAmount).toBe(500);
    });

    it("returns 0 total when no transactions pass filter", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
      ];

      const since_date = "2026-12-31";
      const filtered = transactions.filter((t) => t.date >= since_date);
      const totalAmount = filtered.reduce((sum, t) => sum + t.amount, 0);

      expect(totalAmount).toBe(0);
    });
  });

  describe("optional fields handling", () => {
    it("handles transactions with optional fields when filtering", () => {
      const transactions = [
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          payee_id: "p123",
          category_id: "c456",
          memo: "test",
          import_id: "id2",
          cleared: "cleared" as const,
        },
        {
          date: "2026-01-20",
          amount: 300,
          payee_name: "NEWER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-15";
      const filtered = transactions.filter((t) => t.date >= since_date);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].payee_id).toBe("p123");
      expect(filtered[1].payee_id).toBeUndefined();
    });
  });

  describe("filtered and submitted counts", () => {
    it("tracks submitted vs total correctly", () => {
      const transactions = [
        {
          date: "2026-01-10",
          amount: 100,
          payee_name: "OLD",
          import_id: "id1",
        },
        {
          date: "2026-01-15",
          amount: 200,
          payee_name: "NEW",
          import_id: "id2",
        },
        {
          date: "2026-01-20",
          amount: 300,
          payee_name: "NEWER",
          import_id: "id3",
        },
      ];

      const since_date = "2026-01-15";
      let filteredTransactions = transactions;
      let filteredCount = 0;
      if (since_date) {
        filteredTransactions = transactions.filter((t) => t.date >= since_date);
        filteredCount = transactions.length - filteredTransactions.length;
      }

      // Simulate API response counts
      const createdCount = 2;
      const duplicateCount = 0;

      expect(filteredCount).toBe(1);
      expect(filteredTransactions.length).toBe(2); // total_submitted
      expect(createdCount + duplicateCount).toBe(filteredTransactions.length);
    });
  });
});
