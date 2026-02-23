import { ipcMain } from 'electron';
import * as analyticsQueries from '../db/queries/analytics';
export function registerAnalyticsHandlers() {
    ipcMain.handle('analytics:monthly-stats', async (_, month) => {
        try {
            return analyticsQueries.getMonthlyStats(month);
        }
        catch (error) {
            console.error('Error getting monthly stats:', error);
            throw error;
        }
    });
    ipcMain.handle('analytics:category-breakdown', async (_, data) => {
        try {
            return analyticsQueries.getCategoryBreakdown(data.start_date, data.end_date, data.type);
        }
        catch (error) {
            console.error('Error getting category breakdown:', error);
            throw error;
        }
    });
    ipcMain.handle('analytics:spending-trends', async (_, months) => {
        try {
            return analyticsQueries.getSpendingTrends(months);
        }
        catch (error) {
            console.error('Error getting spending trends:', error);
            throw error;
        }
    });
    ipcMain.handle('analytics:dashboard', async (_, month) => {
        try {
            // Get current month stats
            const currentMonth = analyticsQueries.getMonthlyStats(month);
            // Get previous month stats
            const prevDate = new Date(month + '-01');
            prevDate.setMonth(prevDate.getMonth() - 1);
            const prevMonth = prevDate.toISOString().slice(0, 7);
            const previousMonth = analyticsQueries.getMonthlyStats(prevMonth);
            // Get top expense categories for current and previous month
            const topExpenseCategories = analyticsQueries.getTopExpenseCategories(month, 5);
            const prevMonthCategories = analyticsQueries.getTopExpenseCategories(prevMonth, 5);
            // Get recent transactions and biggest transactions for the month
            const recentTransactions = analyticsQueries.getRecentTransactions(10);
            const topTransactions = analyticsQueries.getTopTransactionsByMonth(month, 5);
            return {
                currentMonth,
                previousMonth,
                topExpenseCategories,
                prevMonthCategories,
                recentTransactions,
                topTransactions,
            };
        }
        catch (error) {
            console.error('Error getting dashboard data:', error);
            throw error;
        }
    });
    ipcMain.handle('analytics:daily-spending', async (_, days = 365) => {
        try {
            return analyticsQueries.getDailySpending(days);
        }
        catch (error) {
            console.error('Error getting daily spending:', error);
            throw error;
        }
    });
    console.log('Analytics IPC handlers registered');
}
