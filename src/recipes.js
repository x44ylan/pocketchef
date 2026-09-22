import categories from "./data/cyberchef-categories.json";

export const isOptionHeading = (value) =>
  /^\[\/?[a-z0-9 -()^]+\]$/i.test(value);
export const optionValue = (option) =>
  typeof option === "object" ? (option.value ?? option.name) : option;
export const optionName = (option) =>
  typeof option === "object" ? option.name : option;
export const isPreset = (arg) =>
  ["populateOption", "populateMultiOption"].includes(arg.type);

export function operationGroups(catalog) {
  const groups = categories
    .filter((group) => group.ops.length)
    .map((group) => ({
      name: group.name,
      ops: group.ops.filter((name) => Object.hasOwn(catalog, name)),
    }))
    .filter((group) => group.ops.length);
  const included = new Set(groups.flatMap((group) => group.ops));
  const extra = Object.keys(catalog).filter((name) => !included.has(name));
  if (extra.length) groups.push({ name: "Uncategorised", ops: extra });
  return groups;
}

export function defaultArgs(spec) {
  return spec.args.map((arg) => {
    if (arg.type === "label") return "";
    if (arg.type === "boolean")
      return arg.value === true || arg.value === "true";
    if (arg.type === "number")
      return arg.value === null || arg.value === "" ? null : Number(arg.value);
    if (arg.type === "toggleString")
      return typeof arg.value === "object"
        ? structuredClone(arg.value)
        : { option: arg.toggleValues[0], string: arg.value ?? "" };
    if (Array.isArray(arg.value)) {
      let selected = arg.value[arg.defaultIndex ?? 0];
      if (isOptionHeading(optionName(selected)))
        selected = arg.value.find((o) => !isOptionHeading(optionName(o)));
      return structuredClone(
        isPreset(arg) || arg.type === "argSelector"
          ? optionName(selected)
          : optionValue(selected),
      );
    }
    return structuredClone(arg.value ?? "");
  });
}

export function hiddenArgs(spec, args) {
  const hidden = new Set();
  spec.args.forEach((arg, index) => {
    if (arg.type !== "argSelector") return;
    const selected = arg.value.find((option) => option.name === args[index]);
    selected?.off?.forEach((i) => hidden.add(i));
    selected?.on?.forEach((i) => hidden.delete(i));
  });
  return hidden;
}

export function updateArgs(spec, args, index, value) {
  const next = structuredClone(args);
  next[index] = value;
  const arg = spec.args[index];
  if (isPreset(arg)) {
    const preset = arg.value.find((option) => option.name === value);
    if (preset && arg.type === "populateMultiOption")
      arg.target.forEach((target, i) => {
        next[target] = preset.value[i];
      });
    // Upstream's empty preset means “user defined”; it keeps the edited value.
    else if (preset?.value) next[arg.target] = preset.value;
  }
  return next;
}

export function validateRecipe(value, catalog) {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Use a CyberChef JSON recipe with at most 100 steps.");
  return value.map((step, index) => {
    if (
      !step ||
      typeof step.op !== "string" ||
      !catalog ||
      !Object.hasOwn(catalog, step.op)
    )
      throw new Error(
        `Step ${index + 1}: ${step?.op || "unknown operation"} is not available in this engine.`,
      );
    if (step.breakpoint)
      throw new Error(
        "Breakpoints are not supported in this preview. Remove them before importing.",
      );
    const spec = catalog[step.op];
    if (!Array.isArray(step.args) || step.args.length !== spec.args.length)
      throw new Error(
        `Step ${index + 1}: expected ${spec.args.length} arguments for ${step.op}.`,
      );
    const args = structuredClone(step.args);
    spec.args.forEach((arg, i) => {
      const v = args[i];
      const invalid = () => {
        throw new Error(
          `Step ${index + 1}: invalid ${arg.name || "argument " + (i + 1)}.`,
        );
      };
      if (arg.type === "label") {
        args[i] = "";
        return;
      }
      if (arg.type === "toggleString") {
        if (
          !v ||
          typeof v !== "object" ||
          typeof v.string !== "string" ||
          !arg.toggleValues.includes(v.option)
        )
          invalid();
      } else if (arg.type === "number") {
        if (v === null && arg.allowEmpty) return;
        if (
          typeof v !== "number" ||
          !Number.isFinite(v) ||
          (arg.integer && !Number.isInteger(v)) ||
          (arg.min != null && v < arg.min) ||
          (arg.max != null && v > arg.max)
        )
          invalid();
      } else if (arg.type === "boolean") {
        if (typeof v !== "boolean") invalid();
      } else {
        if (typeof v !== "string") invalid();
        if (["option", "argSelector"].includes(arg.type)) {
          const match = arg.value.find(
            (o) =>
              !isOptionHeading(optionName(o)) &&
              String(
                arg.type === "argSelector" ? optionName(o) : optionValue(o),
              ).toLowerCase() === v.toLowerCase(),
          );
          if (match === undefined) invalid();
          args[i] =
            arg.type === "argSelector" ? optionName(match) : optionValue(match);
        }
        if (isPreset(arg) && !arg.value.some((o) => o.name === v)) invalid();
      }
    });
    return { op: step.op, args, disabled: Boolean(step.disabled) };
  });
}
