#!/usr/bin/env python3
"""
GradCheck PDF 培养方案提取器
输出格式：{ courses, requirements }
"""
import json
import re
import sys
import pdfplumber
from pathlib import Path

COURSE_CODE_RE = re.compile(r'\b[A-Z]\d{2}[A-Z]\d{4}\b')
CATEGORY_RE = re.compile(r'^\(\d+\)\s*([\u4e00-\u9fffA-Za-z()（）&\s]+)')


def parse_text_lines(text):
    """解析文本行，合并折行"""
    lines = text.split('\n')
    merged = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        code_match = COURSE_CODE_RE.search(line)
        if code_match:
            while i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not next_line:
                    break
                if COURSE_CODE_RE.search(next_line):
                    break
                if CATEGORY_RE.match(next_line):
                    break
                line = line + ' ' + next_line
                i += 1
        merged.append(line)
        i += 1
    return merged


def extract_group_definitions(text):
    """从文本提取组定义"""
    compact = text.replace('\n', ' ')
    compact = re.sub(r'\s+', ' ', compact)
    groups = {}
    pattern = re.compile(r'\[(\d+)\]:([AB]组[：:].+?):(.+?)(?=\[\d+\]:|$)')
    for match in pattern.finditer(compact):
        group_name = match.group(2).strip().replace(':', '：').replace(' ', '')
        course_list = match.group(3)
        courses = [c.strip() for c in re.split(r'[,，]', course_list) if c.strip()]
        courses = [re.sub(r'([\u4e00-\u9fff])\s+([\u4e00-\u9fff])', r'\1\2', c) for c in courses]
        courses = [c for c in courses if len(c) > 1]
        if courses:
            groups[group_name] = courses
    return groups


def normalize_course_name(name):
    name = name.strip()
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = name.replace(' ', '').replace('\u3000', '')
    name = re.sub(r'([\u4e00-\u9fff])\s+([\u4e00-\u9fff])', r'\1\2', name)
    return name


def build_course_to_group_map(group_definitions):
    course_map = {}
    for group_name, courses in group_definitions.items():
        for course_name in courses:
            normalized = normalize_course_name(course_name)
            if normalized:
                course_map[normalized] = group_name
    return course_map


def parse_course_line(line, group_map=None):
    code_match = COURSE_CODE_RE.search(line)
    if not code_match:
        return None
    code = code_match.group()
    rest = line[code_match.end():].strip()
    tokens = rest.split()

    credits = None
    credit_idx = -1
    for idx, token in enumerate(tokens):
        try:
            val = float(token)
            if 0 < val <= 20:
                credits = val
                credit_idx = idx
                break
        except ValueError:
            continue
    if credits is None:
        return None

    name_tokens = tokens[:credit_idx]
    while name_tokens and name_tokens[-1] in ('+', '-', '*'):
        name_tokens.pop()
    name = ''.join(name_tokens) if name_tokens else ""

    academic_year = ""
    semester = ""
    for idx, token in enumerate(tokens):
        if token in ('一', '二', '三', '四'):
            academic_year = token
            if idx + 1 < len(tokens) and tokens[idx + 1].isdigit():
                semester = tokens[idx + 1]
            break

    nature = ""
    for token in tokens:
        if token in ('必修', '选修', '限选', '任选'):
            nature = token
            break

    group = ""
    group_match = re.search(r'([AB]组)[：:]\s*([\u4e00-\u9fffA-Za-z、，,与及\s]+)', line)
    if group_match:
        group = f"{group_match.group(1)}：{group_match.group(2).strip()}"

    if group_map and name:
        normalized = normalize_course_name(name)
        if normalized in group_map:
            mapped_group = group_map[normalized]
            if not group or group in mapped_group or mapped_group.startswith(group[:5]):
                group = mapped_group

    note = ""
    note_keywords = []
    for token in tokens:
        if any(kw in token for kw in ('研讨', '双语', '全英文', '外系', '跨学科')):
            note_keywords.append(token)
    note = ' '.join(note_keywords)

    return {
        "courseCode": code,
        "courseName": name,
        "credits": credits,
        "teachingAcademicYear": academic_year,
        "teachingSemester": semester,
        "nature": nature,
        "group": group,
        "note": note,
    }


def extract_total_credits(text):
    """提取总学分要求"""
    patterns = [
        r'最低计划学分要求\s*(\d+(?:\.\d+)?)',
        r'最低毕业学分\s*(\d+(?:\.\d+)?)',
        r'毕业总学分\s*(\d+(?:\.\d+)?)',
        r'总计\s*(\d+(?:\.\d+)?)',
        r'(?:毕业|总).{0,12}?(\d+(?:\.\d+)?)\s*学分',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return float(match.group(1))
    return None


def extract_category_rules(text):
    """提取各类别学分/门数要求"""
    rules = []
    compact = re.sub(r'\s+', ' ', text)

    # 大类学分
    for match in re.finditer(r'(通识教育基础课程|专业相关课程|集中实践环节(?:（含课外实践）)?(?:\s*&\s*短学期课程)?)\s+(\d+(?:\.\d+)?)', compact):
        rules.append({
            "name": match.group(1).strip(),
            "minCredits": float(match.group(2)),
            "rule": "credits_at_least"
        })

    # 子类学分：合计 XX
    for match in re.finditer(r'\(\d+\)\s*([\u4e00-\u9fffA-Za-z()（）\s]+?)\s+合计\s+(\d+(?:\.\d+)?)', compact):
        name = match.group(1).strip()
        if not any(k in name for k in ['课程编号', '课程名称', '学分']):
            rules.append({
                "name": name,
                "minCredits": float(match.group(2)),
                "rule": "all_courses_required"
            })

    # A组/B组 门数要求
    a_match = re.search(r'A\s*组.*?选修\s*(\d+)\s*门及以上', compact)
    b_match = re.search(r'B\s*组.*?任选\s*(\d+)\s*门及以上', compact)
    if a_match:
        rules.append({"name": "A组专业方向选修", "minCourses": int(a_match.group(1)), "rule": "courses_at_least"})
    if b_match:
        rules.append({"name": "B组专业方向选修", "minCourses": int(b_match.group(1)), "rule": "courses_at_least"})

    # 研讨课学分
    seminar = re.search(r'研讨课学分\s*[≥>=]\s*(\d+(?:\.\d+)?)\s*学分', compact)
    if seminar:
        rules.append({"name": "研讨课学分要求", "minCredits": float(seminar.group(1)), "rule": "credits_at_least"})

    # 全英文课程
    english = re.search(r'全英文课程\s*(\d+)\s*门.*?[≥>=]\s*(\d+(?:\.\d+)?)\s*学分', compact)
    if english:
        rules.append({"name": "全英文课程要求", "minCourses": int(english.group(1)), "minCredits": float(english.group(2)), "rule": "credits_or_courses_at_least"})

    return rules


def extract_non_course_requirements(text):
    """提取非课程要求"""
    reqs = []
    compact = re.sub(r'\s+', ' ', text)

    sport = re.search(r'国家学生体质健康标准.*?≥\s*(\d+(?:\.\d+)?)', compact)
    if sport:
        reqs.append({"name": "体质健康测试", "minScore": float(sport.group(1)), "unit": "分"})

    gpa = re.search(r'平均\s*学分绩点\s*≥\s*(\d+(?:\.\d+)?)', compact)
    if gpa:
        reqs.append({"name": "学士学位平均学分绩点", "minScore": float(gpa.group(1)), "unit": "GPA"})

    if re.search(r'外语达到.*外语学习标准', compact):
        reqs.append({"name": "外语学习标准", "unit": "标准"})

    return reqs


def extract(pdf_path):
    """主提取函数"""
    all_courses = []
    group_definitions = {}

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += "\n" + text
            defs = extract_group_definitions(text)
            if defs:
                group_definitions.update(defs)

        group_map = build_course_to_group_map(group_definitions) if group_definitions else {}

        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            lines = parse_text_lines(text)

            # 按类别切分
            category_positions = []
            for idx, line in enumerate(lines):
                cat_match = CATEGORY_RE.match(line)
                if cat_match:
                    category_positions.append((idx, cat_match.group(1).strip()))

            for idx, (pos, cat_name) in enumerate(category_positions):
                end_pos = category_positions[idx + 1][0] if idx + 1 < len(category_positions) else len(lines)
                for line in lines[pos:end_pos]:
                    course = parse_course_line(line, group_map)
                    if course:
                        course["category"] = cat_name
                        course["sourcePage"] = i
                        all_courses.append(course)

            # 无类别标题的行
            seen_codes = {c["courseCode"] for c in all_courses}
            for line in lines:
                course = parse_course_line(line, group_map)
                if course and course["courseCode"] not in seen_codes:
                    course["category"] = ""
                    course["sourcePage"] = i
                    all_courses.append(course)
                    seen_codes.add(course["courseCode"])

    # 去重：按课程编号，保留信息最全的版本
    by_code = {}
    for c in all_courses:
        code = c["courseCode"]
        existing = by_code.get(code)
        if not existing:
            by_code[code] = c
            continue
        # 优先保留有名称的
        if not existing.get("courseName") and c.get("courseName"):
            by_code[code] = c
        # 优先保留有学年学期的
        elif not existing.get("teachingAcademicYear") and c.get("teachingAcademicYear"):
            by_code[code] = c
        # 优先保留有类别的
        elif not existing.get("category") and c.get("category"):
            by_code[code] = c

    courses = list(by_code.values())

    # 根据类别/组推断性质
    for c in courses:
        if c.get("nature"):
            continue
        check = (c.get("category") or "") + (c.get("group") or "")
        if any(k in check for k in ['思政', '军体', '外语', '自然科学', '大类学科基础', '专业主干', '实践', '短学期', '必修', '四史']):
            c["nature"] = "必修"
        elif any(k in check for k in ['选修', '限选', '任选', 'A组', 'B组']):
            c["nature"] = "选修"
        elif '通识' in check:
            c["nature"] = "通识"

    # 分类整理
    categories = {}
    for c in courses:
        cat = c.get("category") or "未分类"
        group = c.get("group") or ""
        if group:
            cat = f"{cat}-{group}" if cat else group
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(c)

    # 构建 requirements
    total_credits = extract_total_credits(full_text)
    category_rules = extract_category_rules(full_text)
    non_course = extract_non_course_requirements(full_text)

    # 构建 group requirements
    group_requirements = []
    for g_name, g_courses in group_definitions.items():
        group_requirements.append({
            "name": g_name,
            "courseCount": len(g_courses),
            "courses": g_courses
        })

    return {
        "courses": courses,
        "requirements": {
            "totalCreditsRequired": total_credits,
            "categoryRules": category_rules,
            "groupDefinitions": group_requirements,
            "nonCourseRequirements": non_course,
        }
    }


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "2022级软件工程专业培养方案.pdf"
    result = extract(pdf_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
