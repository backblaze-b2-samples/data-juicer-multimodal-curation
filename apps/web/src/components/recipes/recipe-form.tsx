"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useCreateRecipe,
  useOperatorCatalog,
  useUpdateRecipe,
} from "@/lib/queries";
import type {
  Modality,
  OperatorCatalogEntry,
  Recipe,
  RecipeSpec,
} from "@data-juicer-multimodal-curation/shared";

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "image-text", label: "Image-text" },
  { value: "text", label: "Text" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
];

type ParamState = Record<string, Record<string, string>>;

function defaultsFor(
  catalog: OperatorCatalogEntry[],
  modality: Modality
): { checked: Set<string>; params: ParamState } {
  const checked = new Set<string>();
  const params: ParamState = {};
  for (const op of catalog) {
    if (!op.modalities.includes(modality)) continue;
    params[op.name] = {};
    for (const [pname, meta] of Object.entries(op.params)) {
      params[op.name][pname] =
        meta.default !== undefined ? String(meta.default) : "";
    }
    if (op.default && !op.model_backed) checked.add(op.name);
  }
  return { checked, params };
}

function fromRecipe(
  catalog: OperatorCatalogEntry[],
  recipe: Recipe
): { checked: Set<string>; params: ParamState } {
  const base = defaultsFor(catalog, recipe.modality);
  const checked = new Set<string>();
  for (const op of recipe.operators) {
    checked.add(op.name);
    base.params[op.name] = base.params[op.name] ?? {};
    for (const [k, v] of Object.entries(op.params)) {
      base.params[op.name][k] = String(v);
    }
  }
  return { checked, params: base.params };
}

export function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const isEdit = !!recipe;
  const router = useRouter();
  const { data: catalog = [] } = useOperatorCatalog();
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe(recipe?.id ?? "");

  const [name, setName] = useState(recipe?.name ?? "");
  const [modality, setModality] = useState<Modality>(recipe?.modality ?? "image-text");
  const [sourcePrefix, setSourcePrefix] = useState(recipe?.source_prefix ?? "raw/");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [state, setState] = useState<{ checked: Set<string>; params: ParamState }>({
    checked: new Set(),
    params: {},
  });
  const seededRef = useRef(false);

  // Seed operator defaults once the catalog loads (or from the recipe on edit).
  useEffect(() => {
    if (seededRef.current || catalog.length === 0) return;
    seededRef.current = true;
    setState(
      isEdit && recipe ? fromRecipe(catalog, recipe) : defaultsFor(catalog, modality)
    );
  }, [catalog, isEdit, recipe, modality]);

  const availableOps = catalog.filter((op) => op.modalities.includes(modality));

  const onModalityChange = (value: string) => {
    const next = value as Modality;
    setModality(next);
    // Reset the operator selection to the safe defaults for the new modality
    // (image operators don't apply to a text corpus, etc.).
    if (!isEdit) setState(defaultsFor(catalog, next));
  };

  const toggleOp = (opName: string) => {
    setState((prev) => {
      const checked = new Set(prev.checked);
      if (checked.has(opName)) checked.delete(opName);
      else checked.add(opName);
      return { ...prev, checked };
    });
  };

  const setParam = (opName: string, pname: string, value: string) => {
    setState((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        [opName]: { ...(prev.params[opName] ?? {}), [pname]: value },
      },
    }));
  };

  const submit = () => {
    if (name.trim().length === 0) {
      toast.error("Give the recipe a name.");
      return;
    }
    const operators = availableOps
      .filter((op) => state.checked.has(op.name))
      .map((op) => {
        const params: Record<string, number> = {};
        for (const pname of Object.keys(op.params)) {
          const raw = state.params[op.name]?.[pname];
          if (raw !== undefined && raw !== "") params[pname] = Number(raw);
        }
        return { name: op.name, params };
      });
    if (operators.length === 0) {
      toast.error("Select at least one operator.");
      return;
    }
    const spec: RecipeSpec = {
      name: name.trim(),
      modality,
      source_prefix: sourcePrefix,
      operators,
      description: description.trim(),
    };

    const mutation = isEdit ? updateMutation : createMutation;
    mutation.mutate(spec, {
      onSuccess: (saved) => {
        toast.success(isEdit ? "Recipe updated" : "Recipe created");
        router.push(`/recipes/${saved.id}`);
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Failed to save recipe";
        toast.error(detail);
      },
    });
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Recipe</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="image-text-baseline"
              disabled={isEdit}
            />
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                The recipe id is derived from the name and cannot change on edit.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A short, descriptive name. The recipe is stored as
                configs/&lt;slug&gt;.yaml in B2.
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modality</label>
              <Select value={modality} onValueChange={onModalityChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selects the applicable operators below.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Source prefix</label>
              <Select value={sourcePrefix} onValueChange={setSourcePrefix}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw/">raw/</SelectItem>
                  <SelectItem value="raw/demo-text/">raw/demo-text/</SelectItem>
                  <SelectItem value="raw/demo-image-text/">
                    raw/demo-image-text/
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Where the runner reads the corpus JSONL from.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this recipe cleans and why"
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Operators</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Pick operators from the Data-Juicer catalog. Model-backed operators
            download a model and prefer a GPU — they are off by default.
          </p>
          {availableOps.map((op) => {
            const checked = state.checked.has(op.name);
            return (
              <div
                key={op.name}
                className="rounded-md border border-border p-3 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOp(op.name)}
                    id={`op-${op.name}`}
                  />
                  <div className="grid gap-1 leading-none">
                    <label
                      htmlFor={`op-${op.name}`}
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      {op.label}
                      <code className="text-[11px] text-muted-foreground">
                        {op.name}
                      </code>
                      {op.model_backed && (
                        <Badge variant="outline" className="text-[10px]">
                          downloads a model / GPU-preferred
                        </Badge>
                      )}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {op.description}
                    </p>
                  </div>
                </div>
                {checked && Object.keys(op.params).length > 0 && (
                  <div className="grid gap-3 pl-7 sm:grid-cols-2">
                    {Object.entries(op.params).map(([pname, meta]) => (
                      <div key={pname} className="space-y-1">
                        <label className="text-xs font-medium">{pname}</label>
                        <Input
                          type="number"
                          value={state.params[op.name]?.[pname] ?? ""}
                          onChange={(e) => setParam(op.name, pname, e.target.value)}
                          placeholder={meta.hint ?? ""}
                          className="font-mono tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/recipes")}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create recipe"}
        </Button>
      </div>
    </div>
  );
}
