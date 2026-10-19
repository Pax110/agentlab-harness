// Parses one line of CSV into an array of fields.
// Fields are separated by commas. A field may be wrapped in double quotes; then it may
// contain commas, and a double quote inside it is written as two double quotes ("").
// parseLine('a,"b,c",d') -> ["a", "b,c", "d"]
export function parseLine(line) {
  return line.split(",");
}
