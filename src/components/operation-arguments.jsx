import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  hiddenArgs,
  optionName,
  optionValue,
  isOptionHeading,
  isPreset,
} from "@/recipes";

function Options({ arg }) {
  const items = [];
  let group = null;
  arg.value.forEach((option, index) => {
    const name = optionName(option);
    if (isOptionHeading(name)) {
      if (name.startsWith("[/")) group = null;
      else {
        group = { name: name.slice(1, -1), items: [] };
        items.push(group);
      }
      return;
    }
    const value =
      isPreset(arg) || arg.type === "argSelector" ? name : optionValue(option);
    const node = (
      <NativeSelectOption key={index} value={value}>
        {name || "(empty)"}
      </NativeSelectOption>
    );
    if (group) group.items.push(node);
    else items.push(node);
  });
  return items.map((item, i) =>
    item.items ? (
      <NativeSelectOptGroup key={i} label={item.name}>
        {item.items}
      </NativeSelectOptGroup>
    ) : (
      item
    ),
  );
}

export function OperationArguments({ step, index, spec, onChange }) {
  const hidden = hiddenArgs(spec, step.args);
  return (
    <FieldGroup className="gap-4">
      {spec.args.map((arg, i) => {
        if (hidden.has(i)) return null;
        const id = `arg-${index}-${i}`,
          value = step.args[i],
          name = arg.name || "Text";
        if (arg.type === "label")
          return <FieldDescription key={id}>{arg.name}</FieldDescription>;
        if (arg.type === "boolean")
          return (
            <Field key={id} orientation="horizontal">
              <FieldLabel htmlFor={id}>{name}</FieldLabel>
              <Checkbox
                id={id}
                checked={value}
                onCheckedChange={(v) => onChange(i, Boolean(v))}
              />
            </Field>
          );
        const editable = ["editableOption", "editableOptionShort"].includes(
          arg.type,
        );
        return (
          <Field key={id}>
            <FieldLabel htmlFor={id}>{name}</FieldLabel>
            {arg.type === "toggleString" ? (
              <FieldGroup className="argument-value gap-2">
                <Field>
                  <Input
                    id={id}
                    value={value.string}
                    spellCheck={false}
                    autoCapitalize="off"
                    onChange={(e) =>
                      onChange(i, { ...value, string: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-encoding`} className="sr-only">
                    {name} encoding
                  </FieldLabel>
                  <NativeSelect
                    id={`${id}-encoding`}
                    className="w-full"
                    value={value.option}
                    onChange={(e) =>
                      onChange(i, { ...value, option: e.target.value })
                    }
                  >
                    {arg.toggleValues.map((option) => (
                      <NativeSelectOption key={option} value={option}>
                        {option}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>
            ) : [
                "option",
                "argSelector",
                "populateOption",
                "populateMultiOption",
              ].includes(arg.type) ? (
              <NativeSelect
                id={id}
                className="w-full"
                value={value}
                onChange={(e) => onChange(i, e.target.value)}
              >
                <Options arg={arg} />
              </NativeSelect>
            ) : arg.type === "text" ? (
              <Textarea
                id={id}
                value={value}
                rows={arg.rows || 4}
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => onChange(i, e.target.value)}
              />
            ) : (
              <>
                <Input
                  id={id}
                  type={arg.type === "number" ? "number" : "text"}
                  min={arg.min}
                  max={arg.max}
                  step={arg.step ?? (arg.integer ? 1 : "any")}
                  value={value ?? ""}
                  spellCheck={false}
                  autoCapitalize="off"
                  list={editable ? `${id}-options` : undefined}
                  onChange={(e) =>
                    onChange(
                      i,
                      arg.type === "number"
                        ? e.target.value === ""
                          ? null
                          : Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
                {editable && (
                  <datalist id={`${id}-options`}>
                    {arg.value
                      .filter((o) => !isOptionHeading(optionName(o)))
                      .map((o, j) => (
                        <option key={j} value={optionValue(o)}>
                          {optionName(o)}
                        </option>
                      ))}
                  </datalist>
                )}
              </>
            )}
          </Field>
        );
      })}
    </FieldGroup>
  );
}
