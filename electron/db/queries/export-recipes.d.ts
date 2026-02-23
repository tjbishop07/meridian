export interface ExportRecipe {
    id: number;
    name: string;
    url: string;
    institution: string | null;
    steps: string;
    account_id: number | null;
    created_at: string;
    updated_at: string;
    last_run_at: string | null;
    last_scraping_method: string | null;
}
export interface ExportRecipeInput {
    name: string;
    url: string;
    institution?: string;
    steps: any[];
    account_id?: number | null;
}
export declare const exportRecipeQueries: {
    getAll(): ExportRecipe[];
    getById(id: number): ExportRecipe | null;
    create(input: ExportRecipeInput): number;
    update(id: number, input: Partial<ExportRecipeInput>): void;
    delete(id: number): void;
};
