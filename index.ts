import { Client } from "npm:pg";

interface Row {
  table_name: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

async function introspectDatabase(pgUrl: string, tableFilter: string): Promise<TableInfo[]> {
  const client = new Client({ connectionString: pgUrl });
  console.log("Connecting to database...");
  await client.connect();

  const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const filter = new RegExp(tableFilter);

  const tables = await Promise.all(
    result.rows
      .map((row: Row) => row.table_name)
      .filter((tableName: string) => filter.test(tableName))
      .map(async (tableName: string) => {
        const colResult = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [tableName]);
        return {
          name: tableName,
          columns: colResult.rows.map((r: ColumnInfo) => ({
            column_name: r.column_name,
            data_type: r.data_type,
          })),
        } as TableInfo;
      })
  );
  await client.end();
  return tables;
}

function mapToPowerSyncKotlinType(pgType: string): string {
  const type = pgType.toLowerCase();
  return (
    {
      text: "Column.text",
      varchar: "Column.text",
      char: "Column.text",
      enum: "Column.text",
      uuid: "Column.text",
      timestamptz: "Column.text",
      timestamp: "Column.text",
      date: "Column.text",
      time: "Column.text",
      json: "Column.text",
      jsonb: "Column.text",
      interval: "Column.text",
      macaddr: "Column.text",
      inet: "Column.text",
      integer: "Column.integer",
      boolean: "Column.integer",
      real: "Column.real",
      "double precision": "Column.real",
      numeric: "Column.text",
      decimal: "Column.text",
      bytea: "Column.blob",
      geometry: "Column.text",
    }[type] || "Column.text"
  );
}

function generateKotlinSchema(tables: TableInfo[]): string {
  const tableStrings = tables.map((table, i) => {
    const sorted = [...table.columns].sort((a, b) => a.column_name.localeCompare(b.column_name));
    const idComment = sorted.some((col) => col.column_name === "id") ? "                // id column (text) is automatically included," : "";
    const colLines = sorted
      .filter((col) => col.column_name !== "id")
      .map((col, i) => `                ${mapToPowerSyncKotlinType(col.data_type)}("${col.column_name}")${i < sorted.length - 1 ? "," : ""}`);
    return [
      "        Table(",
      `            name = "${table.name}",`,
      "            columns = listOf(",
      ...(idComment ? [idComment] : []),
      ...colLines,
      "            ),",
      "            indexes = listOf()",
      "        )" + (i < tables.length - 1 ? "," : ""),
    ].join("\n");
  });
  const lines = ["import com.powersync.db.schema.*", "", "val AppSchema: Schema = Schema(", "    listOf(", ...tableStrings, "    )", ")"];
  return lines.join("\n");
}

function mapToPowerSyncTsType(pgType: string): string {
  const type = pgType.toLowerCase();
  return (
    {
      text: "column.text",
      varchar: "column.text",
      char: "column.text",
      enum: "column.text",
      uuid: "column.text",
      timestamptz: "column.text",
      timestamp: "column.text",
      date: "column.text",
      time: "column.text",
      json: "column.text",
      jsonb: "column.text",
      interval: "column.text",
      macaddr: "column.text",
      inet: "column.text",
      geometry: "column.text",
      integer: "column.integer",
      boolean: "column.integer",
      real: "column.real",
      "double precision": "column.real",
      numeric: "column.text",
      decimal: "column.text",
      bytea: "column.blob",
    }[type] || "column.text"
  );
}

function generateTypeScriptSchema(tables: TableInfo[]): string {
  const tableStrings = tables.map((table) => {
    const sorted = [...table.columns].sort((a, b) => a.column_name.localeCompare(b.column_name));
    const idComment = sorted.some((col) => col.column_name === "id") ? "    // id column (text) is automatically included," : "";
    const colLines = sorted
      .filter((col) => col.column_name !== "id")
      .map((col, i, arr) => `    ${col.column_name}: ${mapToPowerSyncTsType(col.data_type)}${i < arr.length - 1 ? "," : ""}`);
    return [`const ${table.name} = new Table({`, ...(idComment ? [idComment] : []), ...colLines, "}, { indexes: {} });"].join("\n");
  });

  const schemaTableAssignments = tables.map((table) => `  ${table.name},`);
  const lines = [
    "import { Schema, Table, column } from '@powersync/web';",
    "",
    ...tableStrings.map((s) => `${s}\n`),
    "",
    "export const AppSchema = new Schema({",
    ...schemaTableAssignments,
    "});",
    "",
    "export type Database = (typeof AppSchema)['types'];",
  ];
  return lines.join("\n");
}

export async function generateSchema(pgUrl: string, tableFilter: string, lang: "kt" | "kotlin" | "ts" | "typescript"): Promise<void> {
  const tables = await introspectDatabase(pgUrl, tableFilter);
  if (lang === "ts" || lang === "typescript") {
    const tsCode = generateTypeScriptSchema(tables);
    const outputPath = "schema.ts";
    await Deno.writeTextFile(outputPath, tsCode);
    console.log(`TypeScript schema written to ${outputPath}`);
  } else {
    const kotlinCode = generateKotlinSchema(tables);
    const outputPath = "schema.kt";
    await Deno.writeTextFile(outputPath, kotlinCode);
    console.log(`Kotlin schema written to ${outputPath}`);
  }
}
