import { ipcMain } from 'electron';
import * as analyticsQueries from '../db/queries/analytics';

export function registerAnalyticsHandlers(): void {
  ipcMain.handle('analytics:monthly-stats', async (_, month: string) => {
    try {
      return analyticsQueries.getMonthlyStats(month);
    } catch (error) {
      console.error('Error getting monthly stats:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'analytics:category-breakdown',
    async (
      _,
      data: { start_date: string; end_date: string; type: 'income' | 'expense' }
    ) => {
      try {
        return analyticsQueries.getCategoryBreakdown(
          data.start_date,
          data.end_date,
          data.type
        );
      } catch (error) {
        console.error('Error getting category breakdown:', error);
        throw error;
      }
    }
  );

  ipcMain.handle('analytics:spending-trends', async (_, months: number) => {
    try {
      return analyticsQueries.getSpendingTrends(months);
    } catch (error) {
      console.error('Error getting spending trends:', error);
      throw error;
    }
  });

  ipcMain.handle('analytics:dashboard', async (_, month: string) => {
    try {
      // Get current month stats
      const currentMonth = analyticsQueries.getMonthlyStats(month);

      // Get previous month stats
      const prevDate = new Date(month + '-01');
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = prevDate.toISOString().slice(0, 7);
      const previousMonth = analyticsQueries.getMonthlyStats(prevMonth);

      // Get top expense categories
      const topExpenseCategories = analyticsQueries.getTopExpenseCategories(month, 5);

      // Get recent transactions
      const recentTransactions = analyticsQueries.getRecentTransactions(10);

      // Get spending trends (last 6 months)
      const spendingTrends = analyticsQueries.getSpendingTrends(6);

      return {
        currentMonth,
        previousMonth,
        topExpenseCategories,
        recentTransactions,
        spendingTrends,
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  });

  ipcMain.handle('analytics:daily-spending', async (_, days: number = 365) => {
    try {
      return analyticsQueries.getDailySpending(days);
    } catch (error) {
      console.error('Error getting daily spending:', error);
      throw error;
    }
  });

  console.log('Analytics IPC handlers registered');
}
