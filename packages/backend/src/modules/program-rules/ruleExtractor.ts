import { createHash } from "node:crypto";
import { buildProgramRulePrompt, PROGRAM_RULE_SYSTEM_PROMPT } from "./aiPrompts.js";
import {
  createEmptyDraft,
  createId,
  type CategoryRule,
  type CompletionRule,
  type CourseAssignment,
  type CourseGroupRule,
  type CourseRequirement,
  type GraduationRequirement,
  type NonCourseRequirement,
  type PageParseResult,
  type ProgramMetadata,
  type ProgramRuleDraft,
  type RequirementCategory,
  type RequirementCategoryType,
  type RequirementType
} from "./models.js";

export interface AiRuleExtractor {
  extract(input: { systemPrompt: string; userPrompt: string }): Promise<unknown>;
}

export class ProgramRuleExtractor {
  constructor(private readonly aiExtractor?: AiRuleExtractor) {}

  async extract(pages: PageParseResult[], metadata: ProgramMetadata): Promise<ProgramRuleDraft> {
    const draft = createEmptyDraft(metadata);
    draft.pages = pages;

    mergeHeuristicData(draft, pages);

    if (this.aiExtractor) {
      try {
        const aiData = await this.aiExtractor.extract({
          systemPrompt: PROGRAM_RULE_SYSTEM_PROMPT,
          userPrompt: buildProgramRulePrompt(metadata, pages)
        });
        mergeAiData(draft, aiData);
      } catch (error) {
        draft.extractionWarnings.push(`ai_extraction_failed:${error instanceof Error ? error.message : String(error)}`);
      }
    }

    dedupeDraft(draft);
    ensureCourseAssignments(draft, pages);
    dedupeStructuredRequirements(draft);
    rebuildGraduationRequirements(draft);
    if (draft.courses.length === 0) {
      draft.extractionWarnings.push("no_courses_extracted");
    }
    return draft;
  }
}

function mergeAiData(draft: ProgramRuleDraft, data: unknown): void {
  if (!isRecord(data)) return;
  const pageNumbers = new Set(draft.pages.map((page) => page.pageNumber));
  const courses = Array.isArray(data.courses) ? data.courses : [];
  for (const item of courses) {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.trim() === "") continue;
    const groupName = cleanOptional(item.groupName ?? item.group_name);
    const code = cleanOptional(item.code);
    const credits = toNumber(item.credits);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!code || !COURSE_CODE_PATTERN.test(code) || credits === undefined || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_course_discarded:${cleanOptional(item.name) ?? "unknown"}`);
      continue;
    }
    draft.courses.push({
      id: createId("course"),
      code,
      name: item.name.trim(),
      requirementType: requirementType(String(item.requirementType ?? item.requirement_type ?? "")),
      credits,
      teachingAcademicYear: cleanOptional(item.teachingAcademicYear ?? item.teaching_academic_year),
      teachingSemester: cleanOptional(item.teachingSemester ?? item.teaching_semester),
      suggestedSemester: cleanOptional(item.suggestedSemester ?? item.suggested_semester),
      groupId: groupName ? stableGroupId(groupName) : undefined,
      groupName,
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  for (const item of groups) {
    if (!isRecord(item) || typeof item.name !== "string" || item.name.trim() === "") continue;
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (sourcePage !== undefined && !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_group_discarded:${item.name}`);
      continue;
    }
    draft.groups.push({
      id: stableGroupId(item.name),
      name: item.name.trim(),
      requirementType: requirementType(String(item.requirementType ?? item.requirement_type ?? "elective")),
      minCourses: toInteger(item.minCourses ?? item.min_courses),
      minCredits: toNumber(item.minCredits ?? item.min_credits),
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }

  mergeAiRequirementCategories(draft, data, pageNumbers);
  mergeAiCategoryRules(draft, data, pageNumbers);
  mergeAiCourseAssignments(draft, data, pageNumbers);
  mergeAiNonCourseRequirements(draft, data, pageNumbers);
  mergeAiGraduationRequirements(draft, data, pageNumbers);

  if (isRecord(data.graduationRule) || isRecord(data.graduation_rule)) {
    const rule = (data.graduationRule ?? data.graduation_rule) as Record<string, unknown>;
    draft.graduationRule = {
      totalCreditsRequired: toNumber(rule.totalCreditsRequired ?? rule.total_credits_required),
      requiredCourseCredits: toNumber(rule.requiredCourseCredits ?? rule.required_course_credits),
      electiveCourseCredits: toNumber(rule.electiveCourseCredits ?? rule.elective_course_credits),
      notes: Array.isArray(rule.notes) ? rule.notes.map(String).filter((note) => note.trim().length > 0) : []
    };
  }
}

function mergeAiRequirementCategories(draft: ProgramRuleDraft, data: Record<string, unknown>, pageNumbers: Set<number>): void {
  const categories = arrayField(data, "requirementCategories", "requirement_categories", "categories");
  for (const item of categories) {
    if (!isRecord(item)) continue;
    const name = cleanOptional(item.name);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!name || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_category_discarded:${name ?? "unknown"}`);
      continue;
    }
    const id = cleanOptional(item.id) ?? stableCategoryId(name);
    draft.requirementCategories.push({
      id,
      name,
      type: categoryType(String(item.type ?? "")),
      parentId: cleanOptional(item.parentId ?? item.parent_id),
      requirementType: requirementType(String(item.requirementType ?? item.requirement_type ?? "")),
      minCredits: toNumber(item.minCredits ?? item.min_credits),
      minCourses: toInteger(item.minCourses ?? item.min_courses),
      completionRule: completionRule(String(item.completionRule ?? item.completion_rule ?? "")),
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }
}

function mergeAiCategoryRules(draft: ProgramRuleDraft, data: Record<string, unknown>, pageNumbers: Set<number>): void {
  const rules = arrayField(data, "categoryRules", "category_rules");
  for (const item of rules) {
    if (!isRecord(item)) continue;
    const name = cleanOptional(item.name);
    const categoryName = cleanOptional(item.categoryName ?? item.category_name);
    const categoryId = cleanOptional(item.categoryId ?? item.category_id) ?? (categoryName ? stableCategoryId(categoryName) : undefined);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!name || !categoryId || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_category_rule_discarded:${name ?? "unknown"}`);
      continue;
    }
    draft.categoryRules.push({
      id: cleanOptional(item.id) ?? stableRuleId(categoryId, name),
      categoryId,
      name,
      completionRule: completionRule(String(item.completionRule ?? item.completion_rule ?? "")),
      minCredits: toNumber(item.minCredits ?? item.min_credits),
      minCourses: toInteger(item.minCourses ?? item.min_courses),
      description: cleanOptional(item.description) ?? cleanOptional(item.rawText ?? item.raw_text) ?? name,
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }
}

function mergeAiCourseAssignments(draft: ProgramRuleDraft, data: Record<string, unknown>, pageNumbers: Set<number>): void {
  const assignments = arrayField(data, "courseAssignments", "course_assignments");
  for (const item of assignments) {
    if (!isRecord(item)) continue;
    const courseCode = cleanOptional(item.courseCode ?? item.course_code ?? item.code);
    const categoryName = cleanOptional(item.categoryName ?? item.category_name);
    const categoryId = cleanOptional(item.categoryId ?? item.category_id) ?? (categoryName ? stableCategoryId(categoryName) : undefined);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!courseCode || !COURSE_CODE_PATTERN.test(courseCode) || !categoryId || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_assignment_discarded:${courseCode ?? "unknown"}`);
      continue;
    }
    draft.courseAssignments.push({
      id: stableAssignmentId(courseCode, categoryId),
      courseCode,
      categoryId,
      confidence: clamp(toNumber(item.confidence) ?? 0.82, 0, 1),
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }
}

function mergeAiNonCourseRequirements(draft: ProgramRuleDraft, data: Record<string, unknown>, pageNumbers: Set<number>): void {
  const requirements = arrayField(data, "nonCourseRequirements", "non_course_requirements");
  for (const item of requirements) {
    if (!isRecord(item)) continue;
    const name = cleanOptional(item.name);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!name || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_non_course_requirement_discarded:${name ?? "unknown"}`);
      continue;
    }
    draft.nonCourseRequirements.push({
      id: cleanOptional(item.id) ?? stableNonCourseRequirementId(name),
      name,
      completionRule: completionRule(String(item.completionRule ?? item.completion_rule ?? "")),
      minCredits: toNumber(item.minCredits ?? item.min_credits),
      minCourses: toInteger(item.minCourses ?? item.min_courses),
      minScore: toNumber(item.minScore ?? item.min_score),
      unit: cleanOptional(item.unit),
      description: cleanOptional(item.description) ?? cleanOptional(item.rawText ?? item.raw_text) ?? name,
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }
}

function mergeAiGraduationRequirements(draft: ProgramRuleDraft, data: Record<string, unknown>, pageNumbers: Set<number>): void {
  const requirements = arrayField(data, "graduationRequirements", "graduation_requirements", "requirements");
  for (const item of requirements) {
    if (!isRecord(item)) continue;
    const name = cleanOptional(item.name);
    const sourcePage = toInteger(item.sourcePage ?? item.source_page);
    if (!name || !validSourcePage(sourcePage, pageNumbers)) {
      draft.extractionWarnings.push(`ai_graduation_requirement_discarded:${name ?? "unknown"}`);
      continue;
    }
    const targetCategoryId = cleanOptional(item.targetCategoryId ?? item.target_category_id);
    const targetNonCourseRequirementId = cleanOptional(item.targetNonCourseRequirementId ?? item.target_non_course_requirement_id);
    draft.graduationRequirements.push({
      id: cleanOptional(item.id) ?? stableGraduationRequirementId(String(item.scope ?? "manual"), name),
      name,
      scope: graduationRequirementScope(String(item.scope ?? "")),
      completionRule: completionRule(String(item.completionRule ?? item.completion_rule ?? "")),
      targetCategoryId,
      targetNonCourseRequirementId,
      minCredits: toNumber(item.minCredits ?? item.min_credits),
      minCourses: toInteger(item.minCourses ?? item.min_courses),
      minScore: toNumber(item.minScore ?? item.min_score),
      unit: cleanOptional(item.unit),
      description: cleanOptional(item.description) ?? cleanOptional(item.rawText ?? item.raw_text) ?? name,
      sourcePage,
      rawText: cleanOptional(item.rawText ?? item.raw_text)
    });
  }
}

function mergeHeuristicData(draft: ProgramRuleDraft, pages: PageParseResult[]): void {
  for (const page of pages) {
    const structured = categoriesAndRulesFromText(page.text, page.pageNumber);
    draft.requirementCategories.push(...structured.categories);
    draft.categoryRules.push(...structured.rules);
    draft.nonCourseRequirements.push(...structured.nonCourseRequirements);

    const courseRelevant =
      isCourseRelevantPage(page.text) ||
      page.tables.some((table) => table.rows.some((row) => row.some((cell) => COURSE_CODE_PATTERN.test(cell))));
    for (const table of page.tables) {
      if (courseRelevant) {
        draft.courses.push(...coursesFromTable(table.rows, page.pageNumber));
      }
    }

    if (courseRelevant) {
      draft.courses.push(...coursesFromText(page.text, page.pageNumber));
    }
    draft.groups.push(...groupsFromText(page.text, page.pageNumber));

    const totalCredits = extractTotalCredits(page.text);
    if (totalCredits !== undefined && draft.graduationRule.totalCreditsRequired === undefined) {
      draft.graduationRule.totalCreditsRequired = totalCredits;
    }
  }
}

function categoriesAndRulesFromText(
  text: string,
  pageNumber: number
): { categories: RequirementCategory[]; rules: CategoryRule[]; nonCourseRequirements: NonCourseRequirement[] } {
  const categories: RequirementCategory[] = [];
  const rules: CategoryRule[] = [];
  const nonCourseRequirements: NonCourseRequirement[] = [];
  let currentTopCategory: RequirementCategory | undefined;
  let currentCategory: RequirementCategory | undefined;

  const ensureCategory = (name: string, options: Partial<RequirementCategory> = {}): RequirementCategory => {
    const normalizedName = normalizeCategoryName(name);
    const id = options.id ?? stableCategoryId(normalizedName);
    const existing = categories.find((category) => category.id === id);
    if (existing) {
      mergeCategory(existing, options);
      return existing;
    }
    const category: RequirementCategory = {
      id,
      name: normalizedName,
      type: options.type ?? inferCategoryType(normalizedName),
      parentId: options.parentId,
      requirementType: options.requirementType ?? inferCategoryRequirementType(normalizedName),
      minCredits: options.minCredits,
      minCourses: options.minCourses,
      completionRule: options.completionRule ?? inferCategoryCompletionRule(normalizedName),
      sourcePage: options.sourcePage ?? pageNumber,
      rawText: options.rawText
    };
    categories.push(category);
    return category;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const summary = /^(通识教育基础课程|专业相关课程|集中实践环节（含课外实践）\s*&\s*短学期课程|集中实践环节|短学期课程)\s+(\d+(?:\.\d+)?)/.exec(line);
    if (summary) {
      ensureCategory(summary[1], {
        minCredits: Number(summary[2]),
        completionRule: "credits_at_least",
        sourcePage: pageNumber,
        rawText: line
      });
      continue;
    }

    const topHeading = /^(通识教育基础课|通识教育基础课程|专业相关课程|集中实践环节|短学期课程)$/.exec(line);
    if (topHeading) {
      currentTopCategory = ensureCategory(topHeading[1], { sourcePage: pageNumber, rawText: line });
      currentCategory = currentTopCategory;
      continue;
    }

    const subHeading = /^\(\d+\)\s*([\u4e00-\u9fffA-Za-z0-9（）()&\s]+)$/.exec(line);
    if (subHeading && !/课程编号|课程名称|学分/.test(line)) {
      const inferredParent = currentTopCategory ?? inferredParentCategory(subHeading[1], ensureCategory, pageNumber);
      currentCategory = ensureCategory(subHeading[1], {
        parentId: inferredParent?.id,
        sourcePage: pageNumber,
        rawText: line
      });
      continue;
    }

    const inlineGroup = /(A\s*组|B\s*组)[：:]\s*([\u4e00-\u9fffA-Za-z0-9、，与及\s]+)?/.exec(line);
    if (inlineGroup) {
      const name = `${inlineGroup[1].replace(/\s+/g, "")}${inlineGroup[2] ? `：${inlineGroup[2].trim()}` : ""}`;
      ensureCategory(name, {
        type: "elective_group",
        requirementType: "elective",
        parentId: currentTopCategory?.id,
        completionRule: "courses_at_least",
        sourcePage: pageNumber,
        rawText: line
      });
    }

    const total = /^合计\s+(\d+(?:\.\d+)?)/.exec(line);
    if (total && currentCategory) {
      currentCategory.minCredits ??= Number(total[1]);
      currentCategory.completionRule = currentCategory.requirementType === "required" ? "all_courses_required" : "credits_at_least";
      rules.push({
        id: stableRuleId(currentCategory.id, `${currentCategory.name}合计学分`),
        categoryId: currentCategory.id,
        name: `${currentCategory.name}学分要求`,
        completionRule: currentCategory.completionRule,
        minCredits: currentCategory.minCredits,
        description:
          currentCategory.completionRule === "all_courses_required"
            ? `${currentCategory.name}下课程应全部完成，合计 ${currentCategory.minCredits} 学分。`
            : `${currentCategory.name}至少修满 ${currentCategory.minCredits} 学分。`,
        sourcePage: pageNumber,
        rawText: line
      });
      continue;
    }

    nonCourseRequirements.push(...nonCourseRequirementsFromLine(line, pageNumber));
    rules.push(...categoryRulesFromLine(line, pageNumber, ensureCategory));
  }

  nonCourseRequirements.push(...nonCourseRequirementsFromPageText(text, pageNumber));
  return { categories, rules, nonCourseRequirements };
}

function coursesFromTable(rows: string[][], pageNumber: number): CourseRequirement[] {
  const headerIndex = rows.slice(0, 8).findIndex((row) => {
    const compact = row.map(normalize).join("");
    return compact.includes("课程") && compact.includes("学分");
  });
  if (headerIndex < 0) return [];

  const header = rows[headerIndex].map(normalize);
  const mapping = headerMapping(header);
  if (mapping.name === undefined || mapping.credits === undefined) return [];

  const courses: CourseRequirement[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const parsedLine = parseCourseLine(row.join(" "), pageNumber);
    if (parsedLine) {
      courses.push(parsedLine);
      continue;
    }

    const name = row[mapping.name]?.trim();
    const credits = toNumber(row[mapping.credits]);
    if (!name || credits === undefined || !isPlausibleCourseName(name)) continue;

    const nature = readCell(row, mapping.nature);
    const groupName = readCell(row, mapping.group) || nature || undefined;
    courses.push({
      id: createId("course"),
      code: readCell(row, mapping.code) || undefined,
      name,
      requirementType: requirementType(nature || groupName || ""),
      credits,
      suggestedSemester: readCell(row, mapping.semester) || undefined,
      groupId: groupName ? stableGroupId(groupName) : undefined,
      groupName,
      sourcePage: pageNumber,
      rawText: row.join(" | ")
    });
  }
  return courses;
}

function categoryRulesFromLine(
  line: string,
  pageNumber: number,
  ensureCategory: (name: string, options?: Partial<RequirementCategory>) => RequirementCategory
): CategoryRule[] {
  const rules: CategoryRule[] = [];
  if (!/最低计划学分|最低毕业学分|毕业最低|总学分/.test(line)) {
    const generic = /(?<name>[\u4e00-\u9fffA-Za-z0-9（）()A-Z\s]{2,24}?)(?:不少于|至少|最低|修满)\s*(?:(?<credits>\d+(?:\.\d+)?)\s*学分)?.{0,8}(?:(?<courses>\d+)\s*门)?/.exec(line);
    const captures = generic?.groups;
    if (captures?.name && (captures.credits || captures.courses) && !/必须|备注|参照|根据/.test(captures.name)) {
      const category = ensureCategory(captures.name, {
        type: inferCategoryType(captures.name),
        requirementType: inferCategoryRequirementType(captures.name),
        minCredits: toNumber(captures.credits),
        minCourses: toInteger(captures.courses),
        completionRule: captures.credits && captures.courses ? "credits_or_courses_at_least" : captures.credits ? "credits_at_least" : "courses_at_least",
        sourcePage: pageNumber,
        rawText: line
      });
      rules.push({
        id: stableRuleId(category.id, `${category.name}最低要求`),
        categoryId: category.id,
        name: `${category.name}最低要求`,
        completionRule: category.completionRule,
        minCredits: category.minCredits,
        minCourses: category.minCourses,
        description: line,
        sourcePage: pageNumber,
        rawText: line
      });
    }
  }

  const aGroupRule = /A\s*组.*?选修\s*(\d+)\s*门及以上/.exec(line);
  const bGroupRule = /B\s*组.*?任选\s*(\d+)\s*门及以上/.exec(line);
  if (aGroupRule) {
    const category = ensureCategory("A组专业方向选修", {
      type: "elective_group",
      requirementType: "elective",
      minCourses: Number(aGroupRule[1]),
      completionRule: "courses_at_least",
      sourcePage: pageNumber,
      rawText: line
    });
    rules.push({
      id: stableRuleId(category.id, "A组选修门数"),
      categoryId: category.id,
      name: "A组选修门数要求",
      completionRule: "courses_at_least",
      minCourses: Number(aGroupRule[1]),
      description: `A 组至少选修 ${aGroupRule[1]} 门。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }
  if (bGroupRule) {
    const category = ensureCategory("B组专业方向选修", {
      type: "elective_group",
      requirementType: "elective",
      minCourses: Number(bGroupRule[1]),
      completionRule: "courses_at_least",
      sourcePage: pageNumber,
      rawText: line
    });
    rules.push({
      id: stableRuleId(category.id, "B组选修门数"),
      categoryId: category.id,
      name: "B组选修门数要求",
      completionRule: "courses_at_least",
      minCourses: Number(bGroupRule[1]),
      description: `B 组至少选修 ${bGroupRule[1]} 门。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }

  const seminarCredits = /研讨课学分\s*[≥>=]\s*(\d+(?:\.\d+)?)\s*学分/.exec(line);
  if (seminarCredits) {
    const category = ensureCategory("研讨课学分要求", {
      type: "elective_group",
      requirementType: "elective",
      minCredits: Number(seminarCredits[1]),
      completionRule: "credits_at_least",
      sourcePage: pageNumber,
      rawText: line
    });
    rules.push({
      id: stableRuleId(category.id, "研讨课最低学分"),
      categoryId: category.id,
      name: "研讨课最低学分要求",
      completionRule: "credits_at_least",
      minCredits: Number(seminarCredits[1]),
      description: `研讨课至少 ${seminarCredits[1]} 学分。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }

  return rules;
}

function nonCourseRequirementsFromLine(line: string, pageNumber: number): NonCourseRequirement[] {
  const requirements: NonCourseRequirement[] = [];
  const english = /全英文课程\s*(\d+)\s*门.*?[≥>=]\s*(\d+(?:\.\d+)?)\s*学分/.exec(line);
  if (english) {
    requirements.push({
      id: stableNonCourseRequirementId("全英文课程要求"),
      name: "全英文课程要求",
      completionRule: "credits_or_courses_at_least",
      minCourses: Number(english[1]),
      minCredits: Number(english[2]),
      unit: "门/学分",
      description: `至少选择全英文课程 ${english[1]} 门，或不少于 ${english[2]} 学分。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }

  const sport = /国家学生体质健康标准.*?≥\s*(\d+(?:\.\d+)?)/.exec(line);
  if (sport) {
    requirements.push({
      id: stableNonCourseRequirementId("体质健康测试要求"),
      name: "体质健康测试要求",
      completionRule: "custom",
      minScore: Number(sport[1]),
      unit: "分",
      description: `毕业时国家学生体质健康标准综合成绩应不低于 ${sport[1]} 分。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }

  const gpa = /平均\s*学分绩点\s*≥\s*(\d+(?:\.\d+)?)/.exec(line);
  if (gpa) {
    requirements.push({
      id: stableNonCourseRequirementId("学士学位平均学分绩点要求"),
      name: "学士学位平均学分绩点要求",
      completionRule: "custom",
      minScore: Number(gpa[1]),
      unit: "GPA",
      description: `获得学士学位需满足平均学分绩点不低于 ${gpa[1]}。`,
      sourcePage: pageNumber,
      rawText: line
    });
  }

  if (/外语达到.*外语学习标准/.test(line)) {
    requirements.push({
      id: stableNonCourseRequirementId("外语学习标准要求"),
      name: "外语学习标准要求",
      completionRule: "custom",
      unit: "标准",
      description: "外语需达到东南大学外语学习标准。",
      sourcePage: pageNumber,
      rawText: line
    });
  }

  return requirements;
}

function nonCourseRequirementsFromPageText(text: string, pageNumber: number): NonCourseRequirement[] {
  const compact = text.replace(/\s+/g, " ");
  const requirements: NonCourseRequirement[] = [];

  const sport = /国家学生体质健康标准[\s\S]{0,180}?≥\s*(\d+(?:\.\d+)?)/.exec(compact);
  if (sport) {
    requirements.push({
      id: stableNonCourseRequirementId("体质健康测试要求"),
      name: "体质健康测试要求",
      completionRule: "custom",
      minScore: Number(sport[1]),
      unit: "分",
      description: `毕业时国家学生体质健康标准综合成绩应不低于 ${sport[1]} 分。`,
      sourcePage: pageNumber,
      rawText: sport[0]
    });
  }

  const gpa = /学分绩点\s*≥\s*(\d+(?:\.\d+)?)/.exec(compact);
  if (gpa) {
    requirements.push({
      id: stableNonCourseRequirementId("学士学位平均学分绩点要求"),
      name: "学士学位平均学分绩点要求",
      completionRule: "custom",
      minScore: Number(gpa[1]),
      unit: "GPA",
      description: `获得学士学位需满足平均学分绩点不低于 ${gpa[1]}。`,
      sourcePage: pageNumber,
      rawText: gpa[0]
    });
  }

  return requirements;
}

function inferredParentCategory(
  childName: string,
  ensureCategory: (name: string, options?: Partial<RequirementCategory>) => RequirementCategory,
  pageNumber: number
): RequirementCategory | undefined {
  if (/思政|军体|外语|自然科学|通识选修|新生研讨|四史/.test(childName)) {
    return ensureCategory("通识教育基础课", {
      type: "general_education",
      requirementType: "general",
      completionRule: "credits_at_least",
      sourcePage: pageNumber
    });
  }
  if (/大类学科基础|专业主干|专业方向|跨学科/.test(childName)) {
    return ensureCategory("专业相关课程", {
      type: "course_category",
      requirementType: "unknown",
      completionRule: "credits_at_least",
      sourcePage: pageNumber
    });
  }
  if (/实践|短学期|毕业设计|课外/.test(childName)) {
    return ensureCategory("集中实践环节（含课外实践）与短学期课程", {
      type: "practice",
      requirementType: "required",
      completionRule: "credits_at_least",
      sourcePage: pageNumber
    });
  }
  return undefined;
}

function coursesFromText(text: string, pageNumber: number): CourseRequirement[] {
  const courses: CourseRequirement[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (!line.includes("学分") && !COURSE_CODE_PATTERN.test(line))) continue;
    if (looksLikeRequirementLine(line)) continue;

    const course = parseCourseLine(line, pageNumber);
    if (course) courses.push(course);
  }

  return courses;
}

const COURSE_CODE_PATTERN = /\b(?:[A-Z]\d{2}[A-Z]\d{4}|[A-Z]{1,6}\d[A-Z0-9]{2,}|\d{5,})\b/i;

function parseCourseLine(line: string, pageNumber: number): CourseRequirement | undefined {
  const codeMatch = COURSE_CODE_PATTERN.exec(line);
  if (!codeMatch) return undefined;

  const code = codeMatch[0];
  const rest = line.slice((codeMatch.index ?? 0) + code.length).trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  const creditIndex = findCreditTokenIndex(tokens);
  if (creditIndex < 1) return undefined;

  const nameTokens = tokens.slice(0, creditIndex);
  const inlineNature = /^(必修|选修|限选|任选)$/.test(nameTokens.at(-1) ?? "") ? nameTokens.pop() : undefined;
  const name = stripCourseName(nameTokens.join(" "));
  if (!isPlausibleCourseName(name)) return undefined;
  const nature = inlineNature ?? inferRequirementTypeFromLine(line);
  const groupName = nature || undefined;
  const teachingTerm = parseTeachingTerm(tokens, creditIndex);

  return {
    id: createId("course"),
    code,
    name,
    requirementType: requirementType(nature),
    credits: toNumber(tokens[creditIndex]),
    teachingAcademicYear: teachingTerm.academicYear,
    teachingSemester: teachingTerm.semester,
    suggestedSemester: teachingTerm.academicYear && teachingTerm.semester ? `${teachingTerm.academicYear}-${teachingTerm.semester}` : undefined,
    groupId: groupName ? stableGroupId(groupName) : undefined,
    groupName,
    sourcePage: pageNumber,
    rawText: line
  };
}

function groupsFromText(text: string, pageNumber: number): CourseGroupRule[] {
  const pattern = /(?<name>[\u4e00-\u9fffA-Za-z0-9()（）·\-\s]{2,30}?)(?:不少于|至少|最低|修满)\s*(?:(?<credits>\d+(?:\.\d+)?)\s*学分)?.{0,8}(?:(?<courses>\d+)\s*门)?/;
  const groups: CourseGroupRule[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!/(不少于|至少|最低|修满)/.test(line)) continue;
    if (/最低计划学分|最低毕业学分|毕业最低|总学分/.test(line)) continue;
    const match = pattern.exec(line);
    const captures = match?.groups;
    if (!captures) continue;
    const name = captures.name.trim();
    if (looksLikeNoise(name) || name.length > 18 || /参照|根据|备注|必须/.test(name)) continue;
    groups.push({
      id: stableGroupId(name),
      name,
      requirementType: line.includes("选") ? "elective" : "general",
      minCourses: toInteger(captures.courses),
      minCredits: toNumber(captures.credits),
      sourcePage: pageNumber,
      rawText: line
    });
  }

  return groups;
}

function extractTotalCredits(text: string): number | undefined {
  for (const pattern of [
    /最低计划学分要求\s*(\d+(?:\.\d+)?)/,
    /最低毕业学分\s*(\d+(?:\.\d+)?)/,
    /总计\s*(\d+(?:\.\d+)?)/,
    /(?:毕业|总).{0,12}?(\d+(?:\.\d+)?)\s*学分/,
    /学分.{0,8}?总.{0,8}?(\d+(?:\.\d+)?)/
  ]) {
    const value = toNumber(pattern.exec(text)?.[1]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function isCourseRelevantPage(text: string): boolean {
  if ((text.match(new RegExp(COURSE_CODE_PATTERN.source, "gi")) ?? []).length >= 3) return true;
  return /课程\s*代码|课程\s*名称|课程类别|课程性质|学分\s*学时|建议修读/.test(text);
}

function headerMapping(header: string[]): Record<string, number | undefined> {
  const mapping: Record<string, number | undefined> = {};
  for (const [index, cell] of header.entries()) {
    if (cell.includes("课程代码") || cell.includes("课程编号") || cell === "代码" || cell === "编号") mapping.code = index;
    else if (cell.includes("课程名") || cell === "课程") mapping.name = index;
    else if (cell.includes("学分")) mapping.credits = index;
    else if (cell.includes("学期") || cell.includes("建议")) mapping.semester = index;
    else if (cell.includes("性质") || cell.includes("必修") || cell.includes("选修")) mapping.nature = index;
    else if (cell.includes("组") || cell.includes("模块") || cell.includes("类别") || cell === "类") mapping.group = index;
  }
  return mapping;
}

function dedupeDraft(draft: ProgramRuleDraft): void {
  const courseByKey = new Map<string, CourseRequirement>();
  for (const course of draft.courses) {
    const key = `${course.code ?? ""}:${normalize(course.name)}`;
    if (course.groupName && !course.groupId) course.groupId = stableGroupId(course.groupName);
    const existing = courseByKey.get(key);
    courseByKey.set(key, existing ? betterCourse(existing, course) : course);
  }
  draft.courses = [...courseByKey.values()];

  const groupIds = new Set(draft.groups.map((group) => group.id));
  for (const course of draft.courses) {
    if (!course.groupName || !course.groupId || groupIds.has(course.groupId)) continue;
    draft.groups.push({
      id: course.groupId,
      name: course.groupName,
      requirementType: course.requirementType,
      sourcePage: course.sourcePage
    });
    groupIds.add(course.groupId);
  }

  const seenGroups = new Set<string>();
  draft.groups = draft.groups.filter((group) => {
    group.id = group.id || stableGroupId(group.name);
    if (seenGroups.has(group.id)) return false;
    seenGroups.add(group.id);
    return true;
  });
}

function ensureCourseAssignments(draft: ProgramRuleDraft, pages: PageParseResult[]): void {
  const categoryById = new Map(draft.requirementCategories.map((category) => [category.id, category]));
  const ensureCategory = (name: string, options: Partial<RequirementCategory> = {}): RequirementCategory => {
    const normalizedName = normalizeCategoryName(name);
    const id = options.id ?? stableCategoryId(normalizedName);
    const existing = categoryById.get(id);
    if (existing) {
      mergeCategory(existing, options);
      return existing;
    }
    const category: RequirementCategory = {
      id,
      name: normalizedName,
      type: options.type ?? inferCategoryType(normalizedName),
      parentId: options.parentId,
      requirementType: options.requirementType ?? inferCategoryRequirementType(normalizedName),
      minCredits: options.minCredits,
      minCourses: options.minCourses,
      completionRule: options.completionRule ?? inferCategoryCompletionRule(normalizedName),
      sourcePage: options.sourcePage,
      rawText: options.rawText
    };
    categoryById.set(id, category);
    draft.requirementCategories.push(category);
    return category;
  };

  for (const page of pages) {
    let topCategory: RequirementCategory | undefined;
    let currentCategory: RequirementCategory | undefined;
    let pendingGroupCategory: RequirementCategory | undefined;

    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const topHeading = /^(通识教育基础课|通识教育基础课程|专业相关课程|集中实践环节|短学期课程)$/.exec(line);
      if (topHeading) {
        topCategory = ensureCategory(topHeading[1], { sourcePage: page.pageNumber, rawText: line });
        currentCategory = topCategory;
        continue;
      }

      const subHeading = /^\(\d+\)\s*([\u4e00-\u9fffA-Za-z0-9（）()&\s]+)$/.exec(line);
      if (subHeading && !/课程编号|课程名称|学分/.test(line)) {
        const inferredParent = topCategory ?? inferredParentCategory(subHeading[1], ensureCategory, page.pageNumber);
        currentCategory = ensureCategory(subHeading[1], {
          parentId: inferredParent?.id,
          sourcePage: page.pageNumber,
          rawText: line
        });
        pendingGroupCategory = undefined;
        continue;
      }

      const groupHeading = /(A\s*组|B\s*组)[：:]\s*([\u4e00-\u9fffA-Za-z0-9、，与及\s]+)?/.exec(line);
      if (groupHeading) {
        pendingGroupCategory = ensureCategory(
          `${groupHeading[1].replace(/\s+/g, "")}${groupHeading[2] ? `：${groupHeading[2].trim()}` : ""}`,
          {
            type: "elective_group",
            requirementType: "elective",
            parentId: topCategory?.id ?? currentCategory?.parentId,
            completionRule: "courses_at_least",
            sourcePage: page.pageNumber,
            rawText: line
          }
        );
      }

      const course = parseCourseLine(line, page.pageNumber);
      if (!course?.code) continue;
      const inlineCategory = inlineCourseGroupCategory(line, ensureCategory, page.pageNumber, topCategory);
      const category = inlineCategory ?? pendingGroupCategory ?? currentCategory;
      if (!category) continue;
      draft.courseAssignments.push({
        id: stableAssignmentId(course.code, category.id),
        courseCode: course.code,
        categoryId: category.id,
        confidence: inlineCategory ? 0.9 : 0.72,
        sourcePage: page.pageNumber,
        rawText: line
      });
    }
  }

  const assignedCourseCodes = new Set(draft.courseAssignments.map((assignment) => assignment.courseCode));
  for (const course of draft.courses) {
    if (!course.code || assignedCourseCodes.has(course.code)) continue;
    const category =
      course.requirementType === "required"
        ? ensureCategory("必修课程", {
            type: "required_course_group",
            requirementType: "required",
            completionRule: "all_courses_required",
            sourcePage: course.sourcePage
          })
        : course.requirementType === "elective"
          ? ensureCategory("选修课程", {
              type: "elective_group",
              requirementType: "elective",
              completionRule: "manual_review",
              sourcePage: course.sourcePage
            })
          : ensureCategory("未归类课程", {
              type: "course_category",
              requirementType: "unknown",
              completionRule: "manual_review",
              sourcePage: course.sourcePage
            });
    draft.courseAssignments.push({
      id: stableAssignmentId(course.code, category.id),
      courseCode: course.code,
      categoryId: category.id,
      confidence: 0.45,
      sourcePage: course.sourcePage,
      rawText: course.rawText
    });
  }
}

function inlineCourseGroupCategory(
  line: string,
  ensureCategory: (name: string, options?: Partial<RequirementCategory>) => RequirementCategory,
  pageNumber: number,
  topCategory?: RequirementCategory
): RequirementCategory | undefined {
  const inlineGroup = /(A\s*组|B\s*组)[：:]\s*([\u4e00-\u9fffA-Za-z0-9、，与及\s]+)?/.exec(line);
  if (!inlineGroup) return undefined;
  return ensureCategory(`${inlineGroup[1].replace(/\s+/g, "")}${inlineGroup[2] ? `：${inlineGroup[2].trim()}` : ""}`, {
    type: "elective_group",
    requirementType: "elective",
    parentId: topCategory?.id,
    completionRule: "courses_at_least",
    sourcePage: pageNumber,
    rawText: line
  });
}

function dedupeStructuredRequirements(draft: ProgramRuleDraft): void {
  draft.requirementCategories = mergeById(draft.requirementCategories, mergeCategory);
  draft.categoryRules = mergeById(draft.categoryRules, mergeCategoryRule);
  draft.courseAssignments = mergeById(draft.courseAssignments, mergeCourseAssignment);
  draft.nonCourseRequirements = mergeById(draft.nonCourseRequirements, mergeNonCourseRequirement);
  draft.graduationRequirements = mergeById(draft.graduationRequirements, mergeGraduationRequirement);

  const categoryIds = new Set(draft.requirementCategories.map((category) => category.id));
  draft.categoryRules = draft.categoryRules.filter((rule) => categoryIds.has(rule.categoryId));
  draft.courseAssignments = draft.courseAssignments.filter((assignment) => categoryIds.has(assignment.categoryId));

  const courseCodes = new Set(draft.courses.map((course) => course.code).filter((code): code is string => Boolean(code)));
  draft.courseAssignments = draft.courseAssignments.filter((assignment) => courseCodes.has(assignment.courseCode));
}

export function rebuildGraduationRequirements(draft: ProgramRuleDraft): void {
  const existing = new Map(draft.graduationRequirements.map((requirement) => [requirement.id, requirement]));
  const requirements: GraduationRequirement[] = [];

  if (draft.graduationRule.totalCreditsRequired !== undefined) {
    requirements.push({
      id: "requirement_total_credits",
      name: "毕业总学分要求",
      scope: "program",
      completionRule: "credits_at_least",
      minCredits: draft.graduationRule.totalCreditsRequired,
      unit: "学分",
      description: `毕业总学分不少于 ${draft.graduationRule.totalCreditsRequired} 学分。`
    });
  }

  const categoryById = new Map(draft.requirementCategories.map((category) => [category.id, category]));
  for (const rule of draft.categoryRules) {
    const category = categoryById.get(rule.categoryId);
    requirements.push({
      id: stableGraduationRequirementId("category", rule.id),
      name: rule.name,
      scope: category?.type === "elective_group" ? "course_group" : "category",
      completionRule: rule.completionRule,
      targetCategoryId: rule.categoryId,
      minCredits: rule.minCredits,
      minCourses: rule.minCourses,
      unit: rule.minCredits !== undefined ? "学分" : rule.minCourses !== undefined ? "门" : undefined,
      description: rule.description,
      sourcePage: rule.sourcePage,
      rawText: rule.rawText
    });
  }

  for (const category of draft.requirementCategories) {
    const hasExplicitRule = requirements.some((requirement) => requirement.targetCategoryId === category.id);
    if (hasExplicitRule || (category.minCredits === undefined && category.minCourses === undefined && category.completionRule === "manual_review")) {
      continue;
    }
    requirements.push({
      id: stableGraduationRequirementId("category_default", category.id),
      name: `${category.name}要求`,
      scope: category.type === "elective_group" ? "course_group" : "category",
      completionRule: category.completionRule,
      targetCategoryId: category.id,
      minCredits: category.minCredits,
      minCourses: category.minCourses,
      unit: category.minCredits !== undefined ? "学分" : category.minCourses !== undefined ? "门" : undefined,
      description: categoryRequirementDescription(category),
      sourcePage: category.sourcePage,
      rawText: category.rawText
    });
  }

  for (const requirement of draft.nonCourseRequirements) {
    requirements.push({
      id: stableGraduationRequirementId("non_course", requirement.id),
      name: requirement.name,
      scope: "non_course",
      completionRule: requirement.completionRule,
      targetNonCourseRequirementId: requirement.id,
      minCredits: requirement.minCredits,
      minCourses: requirement.minCourses,
      minScore: requirement.minScore,
      unit: requirement.unit,
      description: requirement.description,
      sourcePage: requirement.sourcePage,
      rawText: requirement.rawText
    });
  }

  for (const requirement of requirements) {
    const manual = existing.get(requirement.id);
    if (manual) mergeGraduationRequirement(requirement, manual);
  }
  draft.graduationRequirements = mergeById(requirements, mergeGraduationRequirement);
}

export function requirementType(value: string): RequirementType {
  if (value.includes("必修")) return "required";
  if (value.includes("选修") || value.includes("限选") || value.includes("任选")) return "elective";
  if (value.includes("通识") || value.includes("通用")) return "general";
  return "unknown";
}

export function stableGroupId(value: string): string {
  return `group_${createHash("sha1").update(normalize(value)).digest("hex").slice(0, 12)}`;
}

function readCell(row: string[], index: number | undefined): string {
  return index === undefined ? "" : row[index]?.trim() ?? "";
}

function normalize(value: string): string {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function cleanOptional(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned || undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function toInteger(value: unknown): number | undefined {
  const number = toNumber(value);
  return number === undefined ? undefined : Math.trunc(number);
}

function looksLikeNoise(value: string): boolean {
  const compact = normalize(value);
  if (compact.length < 2) return true;
  return ["说明", "备注", "学分要求", "毕业要求", "总计", "专业相关课程", "通识教育基础课程", "短学期课程"].some((token) =>
    compact.includes(token)
  );
}

function looksLikeRequirementLine(value: string): boolean {
  if (COURSE_CODE_PATTERN.test(value)) return false;
  const compact = normalize(value);
  return ["毕业", "要求", "至少", "不少于", "最低", "修满", "模块"].some((token) => compact.includes(token));
}

function inferRequirementTypeFromLine(line: string): string {
  const explicit = /(必修|选修|限选|任选)/.exec(line)?.[1];
  if (explicit) return explicit;
  return "";
}

function stripCourseName(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[+&\-·\s]+/, "").replace(/[+&\-·\s]+$/, "").trim();
}

function isPlausibleCourseName(value: string): boolean {
  const compact = normalize(value);
  if (looksLikeNoise(value)) return false;
  if (compact.length < 2 || compact.length > 40) return false;
  if (/^\d+(?:\.\d+)?$/.test(compact)) return false;
  if (/^(一|二|三|四|五|六|七|八|\d)$/.test(compact)) return false;
  return /[\u4e00-\u9fffA-Za-z]/.test(value);
}

function findCreditTokenIndex(tokens: string[]): number {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (!/^\d+(?:\.\d+)?$/.test(token)) continue;
    if (Number(token) > 20) continue;
    if (next === "学分" || next === "學分") continue;
    if (next && ["一", "二", "三", "四", "五", "六", "七", "八"].includes(next) && /^\d+$/.test(tokens[index + 2] ?? "")) {
      return index;
    }
    if (next && (/^\d+(?:\.\d+)?$/.test(next) || ["+", "-", "必修", "选修", "限选", "任选"].includes(next))) {
      return index;
    }
  }
  return -1;
}

function parseTeachingTerm(tokens: string[], creditIndex: number): { academicYear?: string; semester?: string } {
  const yearTokens = new Set(["一", "二", "三", "四", "五", "六", "七", "八"]);
  for (let index = creditIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]?.replace(/[，,;；:：]/g, "");
    const next = tokens[index + 1]?.replace(/[，,;；:：]/g, "");
    if (!token || !yearTokens.has(token)) continue;
    if (next && /^\d+$/.test(next)) {
      return { academicYear: token, semester: next };
    }
  }
  return {};
}

function betterCourse(a: CourseRequirement, b: CourseRequirement): CourseRequirement {
  const score = (course: CourseRequirement): number => {
    let value = 0;
    if (course.requirementType !== "unknown") value += 4;
    if (course.rawText && /(必修|选修|限选|任选)/.test(course.rawText)) value += 3;
    if (course.suggestedSemester) value += 1;
    if (course.name.length > 2) value += 1;
    return value;
  };
  const winner = score(b) > score(a) ? { ...b } : { ...a };
  const fallback = score(b) > score(a) ? a : b;
  winner.teachingAcademicYear ??= fallback.teachingAcademicYear;
  winner.teachingSemester ??= fallback.teachingSemester;
  winner.suggestedSemester ??= fallback.suggestedSemester;
  winner.groupId ??= fallback.groupId;
  winner.groupName ??= fallback.groupName;
  winner.rawText ??= fallback.rawText;
  return winner;
}

function categoryType(value: string): RequirementCategoryType {
  if (value === "required_course_group" || value.includes("必修")) return "required_course_group";
  if (value === "elective_group" || value.includes("选修") || value.includes("限选") || value.includes("任选")) return "elective_group";
  if (value === "general_education" || value.includes("通识")) return "general_education";
  if (value === "practice" || value.includes("实践") || value.includes("短学期")) return "practice";
  if (value === "non_course") return "non_course";
  return "course_category";
}

function completionRule(value: string): CompletionRule {
  if (value === "all_courses_required") return "all_courses_required";
  if (value === "credits_at_least") return "credits_at_least";
  if (value === "courses_at_least") return "courses_at_least";
  if (value === "credits_or_courses_at_least") return "credits_or_courses_at_least";
  if (value === "custom") return "custom";
  return "manual_review";
}

function graduationRequirementScope(value: string): GraduationRequirement["scope"] {
  if (value === "program") return "program";
  if (value === "category") return "category";
  if (value === "course_group") return "course_group";
  if (value === "non_course") return "non_course";
  return "category";
}

export function inferCategoryType(name: string): RequirementCategoryType {
  if (/通识/.test(name)) return "general_education";
  if (/实践|短学期|毕业设计|课外/.test(name)) return "practice";
  if (/选修|限选|任选|A组|B组|方向/.test(name)) return "elective_group";
  if (/必修|思政|军体|外语|自然科学|大类学科基础|专业主干/.test(name)) return "required_course_group";
  return "course_category";
}

export function inferCategoryRequirementType(name: string): RequirementType {
  if (/选修|限选|任选|A组|B组|方向/.test(name)) return "elective";
  if (/必修|思政|军体|外语|自然科学|大类学科基础|专业主干|实践|短学期/.test(name)) return "required";
  if (/通识/.test(name)) return "general";
  return "unknown";
}

function inferCategoryCompletionRule(name: string): CompletionRule {
  if (/必修|思政|军体|外语|自然科学|大类学科基础|专业主干|实践|短学期/.test(name)) return "all_courses_required";
  if (/选修|限选|任选|A组|B组|方向|通识/.test(name)) return "credits_at_least";
  return "manual_review";
}

function normalizeCategoryName(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/^通识教育基础课$/, "通识教育基础课程")
    .replace(/课程$/, "课程")
    .replace(/^集中实践环节（含课外实践）&短学期课程$/, "集中实践环节（含课外实践）与短学期课程")
    .trim();
}

export function stableCategoryId(name: string): string {
  return `category_${createHash("sha1").update(normalizeCategoryName(name)).digest("hex").slice(0, 12)}`;
}

export function stableRuleId(categoryId: string, name: string): string {
  return `rule_${createHash("sha1").update(`${categoryId}:${normalize(name)}`).digest("hex").slice(0, 12)}`;
}

function stableAssignmentId(courseCode: string, categoryId: string): string {
  return `assignment_${createHash("sha1").update(`${courseCode}:${categoryId}`).digest("hex").slice(0, 12)}`;
}

export function stableNonCourseRequirementId(name: string): string {
  return `noncourse_${createHash("sha1").update(normalize(name)).digest("hex").slice(0, 12)}`;
}

export function buildRuleDescription(rule: { name: string; minCredits?: number; minCourses?: number; rule: string }): string {
  if (rule.rule === "all_courses_required") {
    return rule.minCredits !== undefined
      ? `${rule.name}下课程应全部完成，合计 ${rule.minCredits} 学分。`
      : `${rule.name}下课程应全部完成。`;
  }
  if (rule.rule === "credits_at_least" && rule.minCredits !== undefined) {
    return `${rule.name}至少修满 ${rule.minCredits} 学分。`;
  }
  if (rule.rule === "courses_at_least" && rule.minCourses !== undefined) {
    return `${rule.name}至少完成 ${rule.minCourses} 门。`;
  }
  if (rule.rule === "credits_or_courses_at_least") {
    const credits = rule.minCredits !== undefined ? `${rule.minCredits} 学分` : undefined;
    const courses = rule.minCourses !== undefined ? `${rule.minCourses} 门` : undefined;
    return `${rule.name}需满足${[credits, courses].filter(Boolean).join("或")}。`;
  }
  return `${rule.name}需要人工确认完成规则。`;
}

function stableGraduationRequirementId(scope: string, value: string): string {
  return `graduation_requirement_${createHash("sha1").update(`${scope}:${value}`).digest("hex").slice(0, 12)}`;
}

function mergeCategory(target: RequirementCategory, patch: Partial<RequirementCategory>): void {
  target.parentId ??= patch.parentId;
  target.minCredits ??= patch.minCredits;
  target.minCourses ??= patch.minCourses;
  target.sourcePage ??= patch.sourcePage;
  target.rawText ??= patch.rawText;
  if (target.completionRule === "manual_review" && patch.completionRule) target.completionRule = patch.completionRule;
  if (target.requirementType === "unknown" && patch.requirementType) target.requirementType = patch.requirementType;
  if (target.type === "course_category" && patch.type) target.type = patch.type;
}

function mergeCategoryRule(target: CategoryRule, patch: CategoryRule): void {
  target.minCredits ??= patch.minCredits;
  target.minCourses ??= patch.minCourses;
  target.sourcePage ??= patch.sourcePage;
  target.rawText ??= patch.rawText;
  if (target.completionRule === "manual_review") target.completionRule = patch.completionRule;
  if (patch.description.length > target.description.length) target.description = patch.description;
}

function mergeCourseAssignment(target: CourseAssignment, patch: CourseAssignment): void {
  if (patch.confidence > target.confidence) {
    target.confidence = patch.confidence;
    target.sourcePage = patch.sourcePage;
    target.rawText = patch.rawText;
  }
}

function mergeNonCourseRequirement(target: NonCourseRequirement, patch: NonCourseRequirement): void {
  target.minCredits ??= patch.minCredits;
  target.minCourses ??= patch.minCourses;
  target.minScore ??= patch.minScore;
  target.unit ??= patch.unit;
  target.sourcePage ??= patch.sourcePage;
  target.rawText ??= patch.rawText;
  if (patch.description.length > target.description.length) target.description = patch.description;
}

function mergeGraduationRequirement(target: GraduationRequirement, patch: GraduationRequirement): void {
  target.minCredits ??= patch.minCredits;
  target.minCourses ??= patch.minCourses;
  target.minScore ??= patch.minScore;
  target.unit ??= patch.unit;
  target.sourcePage ??= patch.sourcePage;
  target.rawText ??= patch.rawText;
  target.targetCategoryId ??= patch.targetCategoryId;
  target.targetNonCourseRequirementId ??= patch.targetNonCourseRequirementId;
  if (target.completionRule === "manual_review") target.completionRule = patch.completionRule;
  if (patch.description.length > target.description.length) target.description = patch.description;
}

function categoryRequirementDescription(category: RequirementCategory): string {
  if (category.completionRule === "all_courses_required") {
    return category.minCredits !== undefined
      ? `${category.name}下课程应全部完成，合计 ${category.minCredits} 学分。`
      : `${category.name}下课程应全部完成。`;
  }
  if (category.completionRule === "credits_at_least" && category.minCredits !== undefined) {
    return `${category.name}至少修满 ${category.minCredits} 学分。`;
  }
  if (category.completionRule === "courses_at_least" && category.minCourses !== undefined) {
    return `${category.name}至少完成 ${category.minCourses} 门。`;
  }
  if (category.completionRule === "credits_or_courses_at_least") {
    const credits = category.minCredits !== undefined ? `${category.minCredits} 学分` : undefined;
    const courses = category.minCourses !== undefined ? `${category.minCourses} 门` : undefined;
    return `${category.name}需满足${[credits, courses].filter(Boolean).join("或")}。`;
  }
  return `${category.name}需要人工确认完成规则。`;
}

function mergeById<T extends { id: string }>(values: T[], merge: (target: T, patch: T) => void): T[] {
  const byId = new Map<string, T>();
  for (const value of values) {
    const existing = byId.get(value.id);
    if (existing) merge(existing, value);
    else byId.set(value.id, value);
  }
  return [...byId.values()];
}

function arrayField(data: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validSourcePage(sourcePage: number | undefined, pageNumbers: Set<number>): boolean {
  return sourcePage === undefined || pageNumbers.has(sourcePage);
}
