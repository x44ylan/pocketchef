import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Play,
  Square,
  Sun,
  Moon,
  Monitor,
  Braces,
  ChevronDown,
  Check,
  MoreHorizontal,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ChefEngine } from "./engine";
import {
  defaultArgs,
  validateRecipe,
  updateArgs,
} from "./recipes";
import { OperationArguments } from "@/components/operation-arguments";
import { outputText, outputFiles, previewDocument } from "./output";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandEmpty,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Empty, EmptyHeader, EmptyDescription } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toaster } from "@/components/ui/sonner";

const size = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
const byteLength = (text) => new TextEncoder().encode(text).length;
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Appearance() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff",
      );
  }, [resolvedTheme]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Appearance"
          id="theme-toggle"
        >
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function App() {
  const { resolvedTheme } = useTheme();
  const [outputView, setOutputView] = useState("text");
  const [catalog, setCatalog] = useState(null),
    [input, setInput] = useState(""),
    [file, setFile] = useState(null),
    [recipe, setRecipe] = useState([]),
    [tab, setTab] = useState("input");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Loading engine"),
    [result, setResult] = useState(null),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(""),
    [importOpen, setImportOpen] = useState(false),
    [json, setJson] = useState(""),
    [importError, setImportError] = useState("");
  const engine = useRef(null),
    fileInput = useRef(null),
    busyRef = useRef(false);
  useEffect(() => {
    const instance = new ChefEngine((message) => {
      if (busyRef.current) setStatus(message);
    });
    engine.current = instance;
    let active = true;
    instance.ready
      .then((c) => {
        if (active) {
          setCatalog(c);
          setStatus("Ready");
        }
      })
      .catch((e) => {
        if (active) {
          setStatus("Engine unavailable");
          toast.error(e.message);
        }
      });
    return () => {
      active = false;
      instance.fail(new Error("Unmounted"));
    };
  }, []);
  const operationIndex = useMemo(
    () =>
      Object.keys(catalog || {})
        .map((name) => ({ name, searchable: name.toLowerCase() }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );
  const visibleOperations = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return operationIndex.filter(
      (op) => words.every((word) => op.searchable.includes(word)),
    );
  }, [operationIndex, search]);
  const richPreview = useMemo(
    () =>
      result?.data.type === "html"
        ? previewDocument(String(result.data.result), resolvedTheme === "dark")
        : "",
    [result, resolvedTheme],
  );
  const files = useMemo(
    () => (result ? outputFiles(result.data) : []),
    [result],
  );
  const changed = () => setRevision((v) => v + 1);
  const editRecipe = (next) => {
    setRecipe(next);
    changed();
  };
  const add = (op) => {
    if (recipe.length >= 100) {
      toast("Maximum 100 steps");
      return;
    }
    editRecipe([
      ...recipe,
      { op, args: defaultArgs(catalog[op]), disabled: false },
    ]);
    setSearch("");
    setTab("recipe");
  };
  const clearInput = () => {
    setInput("");
    setFile(null);
    changed();
  };
  const example = () => {
    if (!catalog) return;
    setFile(null);
    setInput("SGVsbG8sIHdvcmxkLg==");
    editRecipe([
      {
        op: "From Base64",
        args: defaultArgs(catalog["From Base64"]),
        disabled: false,
      },
    ]);
    setTab("input");
    toast("Example loaded. Bake to decode it.");
  };
  const patchStep = (i, patch) =>
    editRecipe(recipe.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const move = (i, delta) => {
    const next = [...recipe];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    editRecipe(next);
  };
  const openImport = () => {
    setImportError("");
    setImportOpen(true);
  };
  const exportRecipe = () =>
    download(
      new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" }),
      "pocket-chef-recipe.json",
    );
  const importRecipe = () => {
    try {
      if (!catalog) throw new Error("Wait for the engine to load.");
      editRecipe(validateRecipe(JSON.parse(json), catalog));
      setImportOpen(false);
      setTab("recipe");
    } catch (e) {
      setImportError(
        e instanceof SyntaxError
          ? "Enter a valid CyberChef JSON recipe."
          : e.message,
      );
    }
  };
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setFile(null);
      changed();
    } catch {
      toast("Use your keyboard’s Paste action in the input.");
      document.getElementById("input")?.focus();
    }
  }
  async function loadFile(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast("Files can be up to 2 MB in this preview.");
      return;
    }
    try {
      const buffer = await f.arrayBuffer();
      setFile({ name: f.name, buffer });
      setInput(new TextDecoder().decode(buffer.slice(0, 100000)));
      changed();
    } catch {
      toast.error("Could not open this file.");
    }
  }
  async function bake() {
    if (busyRef.current) {
      engine.current.cancel();
      return;
    }
    try {
      validateRecipe(recipe, catalog);
    } catch (e) {
      toast.error(e.message);
      return;
    }
    if ((file?.buffer.byteLength ?? byteLength(input)) > 2 * 1024 * 1024) {
      toast("Input can be up to 2 MB in this preview.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setStatus("Baking");
    const startedRevision = revision;
    try {
      const data = await engine.current.bake(
        file?.buffer ?? input,
        structuredClone(recipe),
      );
      const text = outputText(data);
      setResult({ data, text, revision: startedRevision });
      setOutputView(
        data.type === "html" && /<(?:img|svg)\b/i.test(String(data.result))
          ? "preview"
          : "text",
      );
      setStatus("Complete");
      setTab("output");
    } catch (e) {
      setStatus(e.name === "AbortError" ? "Cancelled" : "Recipe failed");
      toast.error(e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(result.text);
      toast("Output copied");
    } catch {
      toast("Select the output text to copy it.");
    }
  }
  async function downloadOutput() {
    try {
      const files = outputFiles(result.data);
      if (files.length === 1) {
        download(files[0], files[0].name);
        return;
      }
      const bytes = await engine.current.bytes(result.data.dish);
      download(new Blob([bytes]), "pocket-chef-output.bin");
    } catch (e) {
      toast.error(e.message);
    }
  }
  const inputBytes = file?.buffer.byteLength ?? byteLength(input),
    stale = result && result.revision !== revision;
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 23v-9.5C5.2 12.9 4 11.3 4 9.5c0-3.1 3-5.1 6-4.2 2-3.1 10-3.1 12 0 3-.9 6 1.1 6 4.2 0 1.8-1.2 3.4-3 4V23" />
            <path d="M7 23h18v3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-3ZM12 14v5m8-5v5" />
          </svg>
          <h1>PocketChef</h1>
        </div>
        <div className="header-actions">
          <Appearance />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Workspace menu">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                <DropdownMenuItem
                  id="example"
                  onSelect={example}
                  disabled={!catalog}
                >
                  <Play />
                  Load example
                </DropdownMenuItem>
                <DropdownMenuItem id="import-recipe" onSelect={openImport}>
                  <ArrowDownToLine />
                  Import recipe
                </DropdownMenuItem>
                <DropdownMenuItem id="export-recipe" onSelect={exportRecipe}>
                  <ArrowUpFromLine />
                  Export recipe
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <a
                    href="https://github.com/gchq/CyberChef"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CyberChef 11.4.0 ↗
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/engine/LICENSE" target="_blank">
                    License
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="app-main">
        <Tabs value={tab} onValueChange={setTab} className="workspace-tabs">
          <TabsList
            variant="line"
            className="mobile-tabs"
            aria-label="Workspace"
          >
            <TabsTrigger value="input" data-tab="input">
              Input
            </TabsTrigger>
            <TabsTrigger value="recipe" data-tab="recipe">
              Recipe
            </TabsTrigger>
            <TabsTrigger value="output" data-tab="output">
              Output
            </TabsTrigger>
          </TabsList>
          <div className="panels">
            <TabsContent
              value="input"
              forceMount
              id="panel-input"
              className="panel input-panel"
            >
              <div className="panel-heading">
                <h2 className="panel-title">Input</h2>
                <div className="panel-actions">
                  <Button variant="ghost" id="paste" size="sm" onClick={paste}>
                    Paste
                  </Button>
                  <Button
                    variant="ghost"
                    id="open-file"
                    size="icon"
                    aria-label="Open file"
                    title="Open file"
                    onClick={() => fileInput.current.click()}
                  >
                    <ArrowUpFromLine />
                  </Button>
                  <Button
                    id="clear-input"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear input"
                    title="Clear input"
                    onClick={clearInput}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <FieldGroup className="editor-field">
                <Field className="editor-field">
                  <FieldLabel htmlFor="input" className="sr-only">
                    Input data
                  </FieldLabel>
                  <Textarea
                    id="input"
                    variant="code"
                    className="data-editor"
                    value={input}
                    readOnly={Boolean(file)}
                    placeholder="Type or paste your input…"
                    spellCheck={false}
                    autoCapitalize="off"
                    onChange={(e) => {
                      setInput(e.target.value);
                      changed();
                    }}
                  />
                </Field>
              </FieldGroup>
              <div className="panel-meta">
                <span id="input-size">
                  {size(inputBytes)} ·{" "}
                  <span id="input-kind">{file ? "FILE" : "UTF-8"}</span>
                </span>
                <span>
                  {file
                    ? file.name
                    : `${input.split("\n").length} ${input.split("\n").length === 1 ? "line" : "lines"}`}
                </span>
              </div>
              {file && (
                <p className="file-note">
                  Raw file bytes are used. Clear input to edit text.
                </p>
              )}
            </TabsContent>
            <TabsContent
              value="recipe"
              forceMount
              id="panel-recipe"
              className="panel recipe-panel"
            >
              <div className="panel-heading">
                <div>
                  <h2>Recipe</h2>
                  <Badge variant="secondary" id="step-count">
                    {recipe.length}
                  </Badge>
                </div>
                <Button
                  id="clear-recipe"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear recipe"
                  onClick={() => editRecipe([])}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="recipe-content">
                <div id="steps" className="steps">
                  {recipe.map((step, i) => (
                    <Card
                      key={`${i}-${step.op}`}
                      size="sm"
                      className={cn("step", step.disabled && "step-disabled")}
                    >
                      <CardHeader>
                        <CardTitle>
                          <h3>
                            <span className="step-index">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {step.op}
                          </h3>
                        </CardTitle>
                        <CardAction className="flex items-center gap-1">
                          <Switch
                            aria-label={`Enable ${step.op} step ${i + 1}`}
                            checked={!step.disabled}
                            onCheckedChange={(value) =>
                              patchStep(i, { disabled: !value })
                            }
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Step ${i + 1} menu`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  aria-label={`Move step ${i + 1} up`}
                                  disabled={!i}
                                  onSelect={() => move(i, -1)}
                                >
                                  <ArrowUp />
                                  Move up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  aria-label={`Move step ${i + 1} down`}
                                  disabled={i === recipe.length - 1}
                                  onSelect={() => move(i, 1)}
                                >
                                  <ArrowDown />
                                  Move down
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  aria-label={`Remove ${step.op} step ${i + 1}`}
                                  onSelect={() =>
                                    editRecipe(recipe.filter((_, j) => j !== i))
                                  }
                                >
                                  <Trash2 />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardAction>
                      </CardHeader>
                      {catalog[step.op].args.length > 0 && (
                        <CardContent>
                          <details>
                            <summary>
                              Parameters
                              <ChevronDown />
                            </summary>
                            <div className="argument-fields">
                              <OperationArguments
                                step={step}
                                index={i}
                                spec={catalog[step.op]}
                                onChange={(a, v) =>
                                  patchStep(i, {
                                    args: updateArgs(
                                      catalog[step.op],
                                      step.args,
                                      a,
                                      v,
                                    ),
                                  })
                                }
                              />
                            </div>
                          </details>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
                {!recipe.length && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyDescription>
                        Add your first operation.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <Command
                  id="operation-search"
                  className="recipe-search"
                  shouldFilter={false}
                >
                  <CommandInput
                    aria-label="Search operations"
                    placeholder="Search and add an operation…"
                    value={search}
                    onValueChange={setSearch}
                    disabled={!catalog}
                  />
                  {search.trim() && (
                    <CommandList className="operation-list">
                      {visibleOperations.length === 0 && (
                        <CommandEmpty>No operations found.</CommandEmpty>
                      )}
                      <CommandGroup
                        heading={`${visibleOperations.length} ${visibleOperations.length === 1 ? "result" : "results"}`}
                      >
                        {visibleOperations.map(({ name }) => (
                          <CommandItem
                            key={name}
                            value={name}
                            data-operation={name}
                            onSelect={() => add(name)}
                            className="min-h-11"
                          >
                            <Braces />
                            <span className="min-w-0 flex-1">{name}</span>
                            <CommandShortcut>
                              <Plus />
                            </CommandShortcut>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  )}
                </Command>
              </div>
            </TabsContent>
            <TabsContent
              value="output"
              forceMount
              id="panel-output"
              className="panel output-panel"
            >
              <div className="panel-heading">
                <h2 className="panel-title">Output</h2>
                <div className="panel-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    id="copy-output"
                    onClick={copyOutput}
                    disabled={!result}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    id="download-output"
                    aria-label="Download output"
                    title="Download output"
                    onClick={downloadOutput}
                    disabled={!result}
                  >
                    <Download />
                  </Button>
                </div>
              </div>
              {result?.data.type === "html" && (
                <ToggleGroup
                  type="single"
                  value={outputView}
                  onValueChange={(value) => value && setOutputView(value)}
                  size="sm"
                  aria-label="Output view"
                  className="mx-4 mb-2"
                >
                  <ToggleGroupItem value="text">Text</ToggleGroupItem>
                  <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
                </ToggleGroup>
              )}
              {files.length > 0 && (
                <div className="output-files">
                  {files.map((file, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="justify-between"
                      onClick={() => download(file, file.name)}
                    >
                      <span className="truncate">{file.name}</span>
                      <Download data-icon="inline-end" />
                    </Button>
                  ))}
                </div>
              )}
              <div className="output-content">
                {result && outputView === "preview" && richPreview ? (
                  <iframe
                    title="Output preview"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={richPreview}
                    className="output-preview"
                  />
                ) : result ? (
                  <pre id="output" tabIndex={0} aria-label="Output data">
                    {result.text.slice(0, 100000)}
                  </pre>
                ) : (
                  <Empty id="output-empty">
                    <EmptyHeader>
                      <EmptyDescription>
                        Run a recipe to see the output.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
              <div className="panel-meta" id="output-info">
                <span>
                  {result
                    ? size(
                        files.length
                          ? files.reduce((total, file) => total + file.size, 0)
                          : byteLength(result.text),
                      )
                    : "0 B"}
                </span>
                <span id="output-state">
                  {result ? (stale ? "Out of date" : "Baked") : ""}
                </span>
                <span>
                  {result
                    ? `${Math.round(result.data.duration)} ms`
                    : "No output"}
                </span>
              </div>
              {result?.text.length > 100000 && (
                <p className="file-note">
                  Preview limited to 100,000 characters. Copy or download for
                  the full result.
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>
        <div className="bake-bar">
          <div className="bake-status">
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : result && !stale ? (
              <Check />
            ) : (
              <span className="status-dot" />
            )}
            <div>
              <span id="run-status" role="status">
                {status}
              </span>
            </div>
          </div>
          <Button size="lg" id="bake" disabled={!catalog} onClick={bake}>
            {busy ? (
              <Square data-icon="inline-start" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {busy ? "Cancel" : "Bake"}
          </Button>
        </div>
      </main>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent id="import-dialog" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import recipe</DialogTitle>
            <DialogDescription>
              Paste a CyberChef JSON recipe to replace your current steps.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(importError)}>
              <FieldLabel htmlFor="recipe-json">Recipe JSON</FieldLabel>
              <Textarea
                id="recipe-json"
                className="min-h-44"
                aria-label="Recipe JSON"
                aria-invalid={Boolean(importError)}
                value={json}
                onChange={(e) => setJson(e.target.value)}
                spellCheck={false}
                placeholder='[{"op":"From Base64","args":["A-Za-z0-9+/=",true,false]}]'
              />
              <FieldError id="import-error">{importError}</FieldError>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-close="import-dialog">
                Cancel
              </Button>
            </DialogClose>
            <Button id="apply-import" onClick={importRecipe}>
              Use recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input
        id="file-input"
        ref={fileInput}
        type="file"
        hidden
        onChange={loadFile}
      />
      <Toaster position="top-center" />
    </div>
  );
}
