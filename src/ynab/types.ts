/**
 * Re-exports and custom types for YNAB API interaction.
 */
import type * as ynab from "ynab";

// Re-export commonly used YNAB types
export type TransactionDetail = ynab.TransactionDetail;
export type NewTransaction = ynab.NewTransaction;
export type SaveSubTransaction = ynab.SaveSubTransaction;
export type BudgetSummary = ynab.BudgetSummary;
export type BudgetDetail = ynab.BudgetDetail;
export type Account = ynab.Account;
export type Category = ynab.Category;
export type CategoryGroup = ynab.CategoryGroupWithCategories;
export type Payee = ynab.Payee;
export type MonthDetail = ynab.MonthDetail;
export type TransactionClearedStatus = ynab.TransactionClearedStatus;
export type TransactionFlagColor = ynab.TransactionFlagColor;

/** Resolved budget ID -- "default" is mapped to "last-used" for the YNAB API */
export function resolveBudgetId(budgetId?: string): string {
  return budgetId ?? "last-used";
}
