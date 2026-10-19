// Parses one line of CSV into an array of fields.
// Fields are separated by commas. A field may be wrapped in double quotes; then it may
// contain commas, and a double quote inside it is written as two double quotes ("").
// parseLine('a,"b,c",d') -> ["a", "b,c", "d"]
export function parseLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      fields.push(field);
      field = "";
    } else field += ch;
  }
  fields.push(field);
  return fields;
}
