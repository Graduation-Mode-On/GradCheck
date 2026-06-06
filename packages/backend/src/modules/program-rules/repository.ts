import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  toCourseCatalog,
  toRequirementSet,
  type ProgramCourseCatalog,
  type ProgramRequirementSet,
  type ProgramRuleDraft
} from "./models.js";

export class ProgramRuleRepository {
  constructor(private readonly baseDir = "data/program_rules") {}

  async save(draft: ProgramRuleDraft): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });
    await mkdir(this.requirementsDir, { recursive: true });
    await mkdir(this.courseCatalogsDir, { recursive: true });

    const path = join(this.baseDir, `${draft.id}.json`);
    await writeFile(path, JSON.stringify(draft, null, 2), "utf8");
    await writeFile(join(this.requirementsDir, `${draft.id}.json`), JSON.stringify(toRequirementSet(draft), null, 2), "utf8");
    await writeFile(join(this.courseCatalogsDir, `${draft.id}.json`), JSON.stringify(toCourseCatalog(draft), null, 2), "utf8");
    return path;
  }

  async get(draftId: string): Promise<ProgramRuleDraft> {
    const path = join(this.baseDir, `${draftId}.json`);
    return JSON.parse(await readFile(path, "utf8")) as ProgramRuleDraft;
  }

  async getRequirementSet(draftId: string): Promise<ProgramRequirementSet> {
    const path = join(this.requirementsDir, `${draftId}.json`);
    return JSON.parse(await readFile(path, "utf8")) as ProgramRequirementSet;
  }

  async getCourseCatalog(draftId: string): Promise<ProgramCourseCatalog> {
    const path = join(this.courseCatalogsDir, `${draftId}.json`);
    return JSON.parse(await readFile(path, "utf8")) as ProgramCourseCatalog;
  }

  private get requirementsDir(): string {
    return join(this.baseDir, "requirements");
  }

  private get courseCatalogsDir(): string {
    return join(this.baseDir, "course_catalogs");
  }
}
