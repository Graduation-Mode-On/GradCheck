import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DeepSeekRuleExtractor } from "./deepseekExtractor.js";
import { ProgramParsePipeline } from "./pipeline.js";
import { ProgramRuleRepository } from "./repository.js";
import { ProgramRuleExtractor } from "./ruleExtractor.js";

interface CliArgs {
  pdfPath: string;
  out?: string;
  save: boolean;
  storageDir?: string;
  metadata: Record<string, string>;
  llm?: "deepseek";
  deepseekModel?: string;
  usePdfPlumber: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pdfPath = resolveCliPath(args.pdfPath);
  const pipeline = new ProgramParsePipeline({
    extractor: new ProgramRuleExtractor(
      args.llm === "deepseek"
        ? new DeepSeekRuleExtractor({
            model: args.deepseekModel
          })
        : undefined
    ),
    repository: new ProgramRuleRepository(args.storageDir),
    usePdfPlumber: args.usePdfPlumber
  });
  const draft = await pipeline.parse({
    pdfPath,
    metadata: args.metadata,
    save: args.save
  });
  const output = JSON.stringify(draft, null, 2);
  if (args.out) {
    await writeFile(resolveCliPath(args.out), output, "utf8");
  } else {
    console.log(output);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const pdfPath = argv.find((arg) => !arg.startsWith("--"));
  if (!pdfPath) {
    throw new Error(
      "Usage: npm run parse:program -- <program.pdf> [--save] [--out draft.json] [--llm deepseek] [--pdfplumber] [--school ...]"
    );
  }

  const metadata: Record<string, string> = {};
  const args: CliArgs = { pdfPath, save: false, metadata, usePdfPlumber: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--save") args.save = true;
    else if (arg === "--out" && next) args.out = next;
    else if (arg === "--storage-dir" && next) args.storageDir = resolveCliPath(next);
    else if (arg === "--llm" && next === "deepseek") args.llm = "deepseek";
    else if (arg === "--deepseek-model" && next) args.deepseekModel = next;
    else if (arg === "--pdfplumber") args.usePdfPlumber = true;
    else if (arg === "--school" && next) metadata.school = next;
    else if (arg === "--college" && next) metadata.college = next;
    else if (arg === "--major" && next) metadata.major = next;
    else if (arg === "--grade" && next) metadata.grade = next;
    else if (arg === "--version" && next) metadata.version = next;
  }

  return args;
}

function resolveCliPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
