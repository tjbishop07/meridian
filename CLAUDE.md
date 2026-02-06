# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal finance tracking and analysis project. Currently contains USAA bank transaction data exports in CSV format.

## Data Structure

### Transaction Data (`usaa-exports/`)

CSV files contain bank transactions with the following schema:
- **Date**: Transaction date (YYYY-MM-DD)
- **Description**: Cleaned merchant name
- **Original Description**: Raw transaction description from bank
- **Category**: Transaction category (e.g., Shopping, Groceries, Fast Food, Paycheck, etc.)
- **Amount**: Transaction amount (negative for expenses, positive for income)
- **Status**: Transaction status (typically "Posted")

The data contains ~2000 transactions spanning from late 2025 back through the year.

## Development Notes

- This is an early-stage project with no code implementation yet
- The primary data source is USAA bank exports in CSV format
- CSV files appear to have been processed ("fixed-2005.csv" suggests cleaning/transformation has occurred)
- Categories are already applied to transactions, indicating some prior categorization work

## Future Considerations

When building out this project, consider:
- Data format consistency across multiple export files
- Transaction categorization logic (appears to be pre-categorized in exports)
- Date range handling (files may be named by year or date range)
- Handling of duplicate transactions across export files
