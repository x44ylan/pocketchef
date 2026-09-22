// Results are untrusted input. Rich output lives in a scriptless, networkless iframe.
export function resultDocument(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll("script,style,link,meta,base,iframe,object,embed,form")
    .forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    for (const { name, value } of [...node.attributes]) {
      if (
        name.startsWith("on") ||
        [
          "href",
          "xlink:href",
          "action",
          "formaction",
          "srcdoc",
          "srcset",
          "background",
        ].includes(name)
      )
        node.removeAttribute(name);
      if (
        name === "src" &&
        !/^data:(?:image|audio|video)\//i.test(value) &&
        !value.startsWith(`blob:${location.origin}/`)
      )
        node.removeAttribute(name);
    }
  });
  return template;
}

export function outputText(data) {
  if (data.type !== "html") return String(data.result);
  const template = resultDocument(String(data.result));
  template.content
    .querySelectorAll("br")
    .forEach((node) => node.replaceWith("\n"));
  return (
    template.content.textContent ||
    (/data:application\/pdf/i.test(String(data.result))
      ? "PDF ready to download."
      : "")
  );
}

export function previewDocument(html, dark) {
  const body = resultDocument(html).innerHTML;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="color-scheme" content="${dark ? "dark" : "light"}"><style>
  body{margin:16px;font:13px/1.6 system-ui;overflow-wrap:anywhere;color:${dark ? "#eee" : "#171717"};background:${dark ? "#0a0a0a" : "#fff"}}
  img,svg,video{max-width:100%;height:auto} audio{max-width:100%} pre{white-space:pre-wrap;overflow-wrap:anywhere} table{border-collapse:collapse;max-width:100%} td,th{padding:6px;border:1px solid ${dark ? "#333" : "#ddd"}}
  </style></head><body>${body}</body></html>`;
}

export function outputFiles(data) {
  const value = data.dish?.value;
  if (value instanceof File) return [value];
  if (
    Array.isArray(value) &&
    value.length &&
    value.every((item) => item instanceof File)
  )
    return value;
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : Array.isArray(value) &&
            value.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
          ? Uint8Array.from(value)
          : null;
  if (!bytes) return [];
  const starts = (...signature) =>
    signature.every((byte, i) => bytes[i] === byte);
  const type = starts(0x89, 0x50, 0x4e, 0x47)
    ? ["image/png", "png"]
    : starts(0xff, 0xd8, 0xff)
      ? ["image/jpeg", "jpg"]
      : starts(0x47, 0x49, 0x46, 0x38)
        ? ["image/gif", "gif"]
        : starts(0x25, 0x50, 0x44, 0x46, 0x2d)
          ? ["application/pdf", "pdf"]
          : null;
  return type
    ? [new File([bytes], `output.${type[1]}`, { type: type[0] })]
    : [];
}
