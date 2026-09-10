import { RecipeForm } from "@/components/recipes/recipe-form";

export default function NewRecipePage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">New recipe</h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Choose a modality and compose Data-Juicer operators. Defaults are
          lightweight CPU operators — no model download required.
        </p>
      </div>
      <div className="animate-fade-in-up stagger-2">
        <RecipeForm />
      </div>
    </div>
  );
}
